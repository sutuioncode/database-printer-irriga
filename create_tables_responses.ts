import fs from "fs";
import { Database, OPEN_READONLY } from "sqlite3";



const originalHeadersQuery = `SELECT * FROM ResponsesInquerito`;
const originalResponsesQuery = `SELECT * FROM inqueritoResposta WHERE perguntaId IS NOT NULL`;
const headersExtractedFromResponsesQuery = `SELECT * FROM inqueritoResposta WHERE perguntaId ISNULL`;
const sqlFilePath = (path: string) => `./out/sql/${path}.sql`;
const paths = {
  headers: 'headers',
  responses: 'responses',
  fixed_headers: 'fixed_headers',
}

main()
function main() {
  rmFile(paths.fixed_headers)
  rmFile(paths.headers)
  rmFile(paths.responses)

  const files = fs.readdirSync("./dbs")

  const dbPaths = files.filter((x) => x.endsWith(".db"));

  for (let i = 0; i < dbPaths.length; i++) {
    let path = dbPaths[i];
    let db = new Database(`./dbs/${path}`, OPEN_READONLY, (err: any) => {
      if (err) {
        console.error(err.message);
      }
    });


    executeQueryAndSave(db, originalHeadersQuery, paths.headers, convertResponseHeaders, path)
    executeQueryAndSave(db, headersExtractedFromResponsesQuery, paths.fixed_headers, convertResponseToHeaders, path)
    executeQueryAndSave(db, originalResponsesQuery, paths.responses, convertResponse, path)

  }


  function executeQueryAndSave(db: Database, query: string, outputPath: string, stringifyer: (args: any) => string, inputPath: string) {
    db.all(query, [], (error, rows) => {
      if (error) {
        console.log("could not query on file " + inputPath + " with error", error);
        return
      }

      for (const row of rows) {
        console.log(stringifyer(row))
        fs.appendFile(
          sqlFilePath(outputPath),
          stringifyer(row),
          { encoding: "utf-8" },
          (err) => {
            console.log("operation finished with", err);
          }
        );
      }
    }
    )
  }
}

//@ts-ignore
function rmFile(path: typeof paths[string]) {
  try {
    fs.rmSync(sqlFilePath(path))
    console.log("deleted", path)
  } catch (e) {
    console.error("failed to delete with error", e)
  }

}


function convertResponse({ 
  id,
  inqueritoId,
  perguntaId,
  descricao,
  tipo,
  responseId,
  created_at,
  createdBy,
  updated_at,
  updatedBy,
}: any) {
  return `INSERT INTO inqueritoResposta
            (id,
            idInquerito,
            idPergunta,
            descricao,
            tipo,
            idResponses,
            createdOn,
            createdBy,
            updatedOn,
            updatedBy)
        values(
          '${cnv_id(id)}',
          '${cnv_id(inqueritoId)}',
          ${cnv_v(perguntaId)},
          '${cnv_v(descricao)}',
          '${cnv_v(tipo)}',
          '${cnv_id(responseId)}',
          ${cnv_date(created_at)},
          '${cnv_id(createdBy)}',
          ${cnv_date(updated_at)},
          ${cnv_id(updatedBy)}
        ) 
  `
}

function convertResponseHeaders({
  id,
  inqueritoId,
  beneficiarioId,
  regadioId,
  escolaId,
  parentResponseId,
  parentInqueritoId,
  created_at,
  createdBy,
  updatedBy,
  updated_at

}: any) {
  return `INSERT INTO ResponsesInquerito
  (id,
    idInquerito,
    idBeneficiario,
    idRegadio,
    idEscola,
    idResponsesPai,
    idInqueritoPai,
    createdOn,
    createdBy,
    updatedBy,
    updatedOn) 
  
        values(
          ${cnv_id(id)},
          ${cnv_id(inqueritoId)},
          ${cnv_id(beneficiarioId)},
          ${cnv_id(regadioId)},
          ${cnv_id(escolaId)},
          ${cnv_id(parentResponseId)},
          ${cnv_id(parentInqueritoId)},
          ${cnv_date(created_at)},
          ${cnv_id(createdBy)},
          ${cnv_date(updated_at)},
          ${cnv_id(updatedBy)}
        ) 
  `
}
function convertResponseToHeaders({
  id,
  inqueritoId,
  created_at,
  createdBy,
  updated_at,
  updatedBy,

}: any) {
  return `INSERT INTO ResponsesInquerito
  (id,
    idInquerito,
    
    createdOn,
    createdBy,
    updatedBy,
    updatedOn) 
  
        values(
          ${cnv_id(id)},
          ${cnv_id(inqueritoId)},
          ${cnv_date(created_at)},
          ${cnv_id(createdBy)},
          ${cnv_date(updated_at)},
          ${cnv_id(updatedBy)}
        ) 
  `
}


function cnv_id(text: string): string {
  if (!text) return `NULL`
  return `CONVERT(uniqueidentifier,'${(text as string).toLocaleUpperCase()}')`
}

function cnv_date(text?: string): string {
  if (!text) return `NULL`
  return `DATEADD(S, CONVERT(int,LEFT(${text}, 10)), '1970-01-01')`
}

function cnv_v(text?: string): string {
  if (!text) return `NULL`
  return `${text}`
}