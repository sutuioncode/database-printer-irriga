import { Database, OPEN_READONLY } from "sqlite3";
import fs from "fs";
import { groupBy, values } from "lodash";

const mainResponseQuery = `
SELECT  
  json_group_array(
  json_object(
    'grupo_resposta',quiz_id,
    'formulario_id',form_responses.form_id,
    'perguntaId',fields.id,
    'resposta',response,
    'context',context,
    'contextId',context_id,
    'respostaId',response,
    'pergunta',fields.label,
    'required', validations.required,
    'status', form_responses._status,
    'fieldType', fields.type,
    'formulario',forms.name
    )
  )
FROM form_responses 
  INNER JOIN fields 
    ON form_responses.field_id = fields.id
  FULL JOIN validations 
    ON validations.id = fields.id
  JOIN forms 
    ON form_responses.form_id = forms.id 
ORDER BY quiz_id, forms.name`;
const subFormResponseQuery = `
SELECT 
  json_group_array(
    json_object(
    'grupoRespostaSubFormulario',subform_quiz_id,
    'subFormulario_id',subform_id,
    'subFormulario',forms.name,
    'grupoFormuarioResposta',quiz_id,
    'respostaId',form_responses.id,
    'required', validations.required,
    'perguntaId',fields.id,
    'resposta',response,
    'fieldType', fields.type,
    'Pergunta',fields.label
    )
  )
FROM form_responses 
  INNER JOIN fields 
    ON form_responses.field_id = fields.id 
   FULL JOIN validations 
    ON validations.id = fields.id
  INNER JOIN forms
    ON forms.id = subform_id
WHERE subform_quiz_id is not null`;

const countFormResponsesQuery = `
SELECT 
  json_object(
    'quizCount',count(distinct quiz_id),
    'form',  forms.name,
    'formId',form_id
    )
FROM form_responses
	JOIN forms
		ON form_id = forms.id
GROUP BY form_id, forms.name
ORDER BY forms.name`;

fs.readdir("./dbs", (err, files) => {
  const dbPaths = files.filter((x) => x.endsWith(".db"));
  const mainFormResponses = [] as { res: string; path: string }[];
  const subFormResponses = [] as { res: string; path: string }[];
  let countInterations = 0
  const countResponsesMap = new Map<
    string,
    { form: string; quizCount: number }
  >();

  for (let i = 0; i < dbPaths.length; i++) {
    let path = dbPaths[i];
    let db = new Database(`./dbs/${path}`, OPEN_READONLY, (err: any) => {
      if (err) {
        console.error(err.message);
      }
    });
    /**** EXECUTING SQL QUERY */
    db.all(mainResponseQuery, [], (error, rows) => {
      if (error) {
        console.log(error);
      }
      if (rows.length > 0) {
        mainFormResponses.push({ res: values(rows[0])[0], path });
      }
      parseAll(mainFormResponses, subFormResponses, dbPaths.length);
    });
    /**** EXECUTING SQL QUERY */
    db.all(subFormResponseQuery, [], (error, rows) => {
      if (error) {
        console.log(error);
      }
      if (rows.length > 0) {
        subFormResponses.push({ res: values(rows[0])[0], path });
      }
      parseAll(mainFormResponses, subFormResponses, dbPaths.length);
    });
    db.all(countFormResponsesQuery, [], (error, rows) => {
      countInterations++
      if (error) {
        console.log(error);
      }
      if (rows.length > 0) {
        for (const row of rows) {
          console.log(row)
          const obj = JSON.parse(values(row))
          const form = countResponsesMap.get(obj.formId);
          if (form) {
            console.log(obj.form)
            countResponsesMap.set(obj.formId, {
              ...form,
              quizCount: obj.quizCount + form.quizCount,
            });
          } else {
            countResponsesMap.set(obj.formId, {
              form: obj.form,
              quizCount: obj.quizCount,
            });
          }
        }
      }

      if(countInterations === dbPaths.length){
        console.log(countResponsesMap)
        save(JSON.stringify(new Array(countResponsesMap.values())),"totalQuizCount")
      }
      parseAll(mainFormResponses, subFormResponses, dbPaths.length);
    });
    /**** CLOSING DATABASE */
    db.close((err) => {
      if (!err) {
        console.log("Database closed");
      } else console.log("Database failed to closed");
    });
  }
});

function parseAll(
  main: { res: string; path: string }[],
  sub: { res: string; path: string }[],
  size: number
) {
  console.log("parseAll", { main: main.length, size });
  if (main.length === size && sub.length === size) {
    for (const form of main) {
      save(
        JSON.stringify({ res: JSON.parse(form.res), path: form.path }),
        `responses = ${form.path}`
      );
    }
    // save(joinUnparsedResponses(sub).toString(), "all-subs");
    const allforms = mergeMainAndSubFormResponses(
      joinUnparsedResponses(main.map((x) => x.res)),
      joinUnparsedResponses(sub.map((x) => x.res))
    );
    save(JSON.stringify(allforms, null, 2), "temp-all-forms");

    createInquires(allforms);
  }
}

function parseFormResponses(data: string) {
  const json = JSON.parse(data);
  //@ts-ignore
  const grupoDic = groupBy(json, (l) => l.formulario_id);
  const formList = [];
  for (const key in grupoDic) {
    if (Object.prototype.hasOwnProperty.call(grupoDic, key)) {
      const element = grupoDic[key];

      const responsesDic = groupBy(element, (l) => l.grupo_resposta);

      const responsesList = [];
      for (const reskey in responsesDic) {
        if (Object.prototype.hasOwnProperty.call(responsesDic, reskey)) {
          const res = responsesDic[reskey];
          responsesList.push({
            //@ts-ignore
            key: reskey,
            responses: res.map(
              ({
                pergunta,
                resposta,
                fieldType,
                required,
                perguntaId,
                context,
                contextId,
                status,
              }) => ({
                pergunta,
                fieldType,
                required,
                status,
                context,
                contextId,
                resposta,
                perguntaId,
              })
            ),
          });
        }
      }

      // const formsDic = groupBy(element,(l)=> l.grupo_resposta)
      formList.push({
        key,
        count: responsesList.length,
        form: element[0].formulario,
        //@ts-ignore
        quizes: responsesList,
      });
    }
  }
  // console.log(formList);
  return formList;
}

function mergeMainAndSubFormResponses(mainForm: string, subForm: string) {
  const parsedMain = parseFormResponses(mainForm);
  const parsedSub = parseSubFormResponses(subForm);

  return parsedMain.map((x) => {
    return {
      ...x,
      quizes: x.quizes.map((p) => {
        const subResponses = parsedSub.find((s) => s.key === p.key);
        if (subResponses) {
          return { ...p, subResponses: subResponses.subforms };
        }
        return p;
      }),
    };
  });
}

function parseSubFormResponses(data: string) {
  const json = JSON.parse(data);
  //@ts-ignore
  const grupoDic = groupBy(json, (l) => l.grupoFormuarioResposta);

  const list = [];
  for (const key in grupoDic) {
    if (Object.prototype.hasOwnProperty.call(grupoDic, key)) {
      const main = grupoDic[key];
      //@ts-ignore
      const grupoSubforms = groupBy(main, (l) => l.grupoRespostaSubFormulario);
      const sublist = [];
      for (const subkey in grupoSubforms) {
        if (Object.prototype.hasOwnProperty.call(grupoSubforms, subkey)) {
          const element = grupoSubforms[subkey];

          sublist.push({
            subform: element[0].subFormulario,
            formId: element[0].subFormulario_id,
            key: element[0].grupoRespostaSubFormulario,
            //@ts-ignore
            responses: element.map(
              ({ Pergunta, required, resposta, perguntaId }) => ({
                Pergunta,
                required,
                resposta,

                perguntaId,
              })
            ),
          });
        }
        list.push({ key, count: sublist.length, subforms: sublist });
      }
    }
  }
  return list;
}
/**** PRINTS THE CONTENT @param data INTO A JSON FILE OF @param name */
function save(data: string, name: string) {
  return fs.writeFile(
    `./out/${name}.json`,
    data,
    { encoding: "utf-8" },
    //@ts-ignore
    (x) => {
      console.log("onComplete", x);
    }
  );
}

function joinUnparsedResponses(forms: string[]): string {
  return forms
    .reduce((acc, value, index, array) => {
      if (index === 0) return value;
      if (value === "[]") return acc;
      const charIndex = acc.lastIndexOf("]");
      return acc.substring(0, charIndex) + "," + value.replace(/\[/, "");
    }, "")
    .replace("[,", "[");
}
type Form = (
  | {
      key: string;
      form: any;
      //@ts-ignore
      quizes: {
        //@ts-ignore
        key: string;
        responses: {
          pergunta: any;
          context: any;
          contextId: any;
          resposta: any;
          perguntaId: any;
        }[];
      }[];
    }
  | {
      subResponses: {
        key: string;
        subforms: {
          subform: any;
          //@ts-ignore
          responses: {
            pergunta: any;
            context: any;
            contextId: any;
            resposta: any;
            perguntaId: any;
          }[];
        }[];
      };
      key: string;
      form: any;
      //@ts-ignore
      quizes: {
        //@ts-ignore
        key: string;
        responses: {
          pergunta: any;
          context: any;
          contextId: any;
          resposta: any;
          perguntaId: any;
        }[];
      }[];
    }
)[];

function createInquires(allforms: Form) {
  const beneficiaryForms = allforms.filter(
    (x) => x.key === "abf1cb25-5ed6-47c2-9219-d414c373663b"
  )[0].quizes;
  // const waterSupplyForms = allforms.filter(
  //   (x) => x.key === "ecce9f56-ff36-4f6a-a9fa-717b17339a32"
  // )[0].quizes;
  const inquireForms = allforms.filter(
    (x) => x.key === "a2c36e37-39af-453b-8b91-123d23fb780c"
  )[0].quizes;
  save(JSON.stringify(inquireForms), "inquire");
  save(
    JSON.stringify(
      inquireForms.map(({ key, responses }) => {
        const ben = beneficiaryForms.find((x) => {
          return x.key === responses[0].contextId;
        });

        const beneficiary = ben?.responses.reduce((acc, response) => {
          return {
            name: response.perguntaId === "1" ? response.resposta : acc.name,
            apelido:
              response.perguntaId === "2" ? response.resposta : acc.apelido,
            associacao:
              response.perguntaId === "20" ? response.resposta : acc.associacao,
            regadio: response.resposta,
            /* response.perguntaId === "21"
                // ? waterSupplyForms
                //     .filter((x) => x.key === response.resposta)[0]
                //     ?.responses.find((x) => x.perguntaId === "10") ??
                //   response.resposta
                // : acc.regadio,*/
          };
        }, {});

        return {
          key,
          beneficiary,
          responses,
        };
      })
    ),
    "inquire-mapped"
  );
  save(JSON.stringify(beneficiaryForms), "beneficiary");
}
