-- Main Responses
SELECT  
	json_group_array(json_object(
	'grupo_resposta',quiz_id,
	'formulario_id',form_responses.id,
	'perguntaId',fields.id,
	'resposta',response,
	'pergunta',fields.label,
	'formulario',forms.name))
FROM form_responses 
	inner join fields 
        on field_id = fields.id
	join forms 
        on form_responses.form_id = forms.id 
Order BY quiz_id, forms.name

-- Request Subform responses
SELECT json_group_array(
	json_object(
	'grupoRespostaSubFormulario',subform_quiz_id,
	'subFormulario_id',subform_id,
	'subFormulario',forms.name,
	'grupoFormuarioResposta',quiz_id,
	'respostaId',form_responses.id,
	'perguntaId',fields.id,
	'resposta',response,
	'Pergunta',fields.label
	))
	FROM form_responses 
		INNER JOIN fields 
			on field_id = fields.id 
		inner join forms
			on forms.id = subform_id

WHERE subform_quiz_id is not null
	


