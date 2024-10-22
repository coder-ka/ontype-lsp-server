import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parse } from "knotta";

const connection = createConnection(ProposedFeatures.all);

const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  const hasSemanticTokensCapability = !!(
    capabilities.textDocument && capabilities.textDocument.semanticTokens
  );

  const result: InitializeResult = {
    capabilities: {
      semanticTokensProvider: hasSemanticTokensCapability
        ? {
            documentSelector: [
              {
                language: "knotta",
              },
            ],
            legend: {
              tokenTypes: [
                "string",
                "keyword",
                "type",
                "decorator",
                "property",
                "operator",
              ],
              tokenModifiers: ["declaration"],
            },
            full: {
              delta: true,
            },
          }
        : undefined,
    },
  };

  return result;
});

connection.languages.semanticTokens.on(async (params) => {
  const { textDocument } = params;
  const document = documents.get(textDocument.uri);

  const text = document?.getText();

  if (text) {
    const {
      result: { semanticTokens },
    } = await parse(
      (async function* () {
        yield text;
      })(),
      {
        enableAst: false,
        ast: { baseModels: [], types: [] },
        enableSemanticTokens: true,
        semanticTokens: [],
      },
      {
        onError: "continue",
      }
    );

    return {
      data: semanticTokens.flatMap(
        ({ type, length, line, inlineIndex }, i, arr) => {
          const prev = i === 0 ? undefined : arr[i - 1];
          const prevLine = prev?.line || 0;
          const prevInlineIndex = prev?.inlineIndex || 0;
          return [
            line - prevLine,
            inlineIndex - (prevLine === line ? prevInlineIndex : 0),
            length,
            {
              import: 1,
              string: 0,
              type: 1,
              "type-name": 2,
              "type-decorator": 3,
              "prop-name": 4,
              "prop-optional": 5,
              "prop-type-name": 2,
              "prop-ref": 4,
              "prop-decorator": 3,
            }[type] || 0,
            {
              "type-name": 1,
              "prop-name": 1,
            }[type] || 0,
          ];
        }
      ),
    };
  } else {
    return {
      data: [],
    };
  }
});

documents.listen(connection);

connection.listen();
