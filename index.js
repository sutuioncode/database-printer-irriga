"use strict";
const fs = require("fs");
const { groupBy } = require("lodash");
function parseFormResponses(data) {
    const json = JSON.parse(data);
    //@ts-ignore
    const grupoDic = groupBy(json, (l) => l.grupo_resposta);
    const list = [];
    for (const key in grupoDic) {
        if (Object.prototype.hasOwnProperty.call(grupoDic, key)) {
            const element = grupoDic[key];
            // const formsDic = groupBy(element,(l)=> l.grupo_resposta)
            list.push({
                key,
                form: element[0].formulario,
                formId: element[0].formulario_id,
                //@ts-ignore
                responses: element.map(({ pergunta, resposta, perguntaId }) => ({
                    pergunta,
                    resposta,
                    perguntaId,
                })),
            });
        }
    }
    // console.log({ list });
    return list;
}
function parseAllForms(mainForm, subForm) {
    const parsedMain = parseFormResponses(mainForm);
    const parsedSub = parseSubFormResponses(subForm);
    return parsedMain.map((x) => {
        const subResponses = parsedSub.find((s) => s.key === x.key);
        if (subResponses)
            return { ...x, subResponses };
        return x;
    });
}
function parseSubFormResponses(data) {
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
                        //@ts-ignore
                        responses: element.map(({ Pergunta, resposta, perguntaId }) => ({
                            Pergunta,
                            resposta,
                            perguntaId,
                        })),
                    });
                }
                list.push({ key, subforms: sublist });
            }
        }
    }
    return list;
}
function save(data, name) {
    return fs.writeFile(`./out/${name}.json`, data, { encoding: "utf-8" }, 
    //@ts-ignore
    (x) => {
        console.log("onComplete", x);
    });
}
const subforms = require("./in/subform_d266c5f52bd37ad4.json");
const forms = require("./in/main_d266c5f52bd37ad4.json");
save(JSON.stringify(parseAllForms(forms, subforms)), "d266c5f52bd37ad4");
