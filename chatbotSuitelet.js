/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

define(['N/ui/serverWidget', 'N/llm', './poHandler.js', 'N/log'], (serverWidget, llm, poHandler, log) => {

  function onRequest(context) {
    const form = serverWidget.createForm({ title: 'Warehouse Chat Bot' });
    const fieldGroup = form.addFieldGroup({ id: 'chatgroup', label: 'Chat' });
    fieldGroup.isSingleColumn = true;

    const chatHistory = [];
    const historySize = parseInt(context.request.parameters.custpage_num_chats || '0', 10);
    const numChats = form.addField({
      id: 'custpage_num_chats',
      label: 'History Count',
      type: serverWidget.FieldType.INTEGER,
      container: 'chatgroup'
    });
    numChats.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

    // Re-render history
    for (let i = 0; i < historySize; i += 2) {
      const userText = context.request.parameters['custpage_hist' + i];
      let botText = context.request.parameters['custpage_hist' + (i + 1)];
      
      const userField = form.addField({
        id: 'custpage_hist' + i,
        type: serverWidget.FieldType.TEXTAREA,
        label: 'You',
        container: 'chatgroup'
      });
      userField.defaultValue = userText;
      userField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });

      const botField = form.addField({
        id: 'custpage_hist' + (i + 1),
        type: serverWidget.FieldType.TEXTAREA,
        label: 'ChatBot',
        container: 'chatgroup'
      });
      if (botText.length > 3990) {
        botText = botText.substring(0, 3990) + '...';
      }
      botField.defaultValue = botText;
      botField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });

      chatHistory.push({ role: 'user', text: userText });
      chatHistory.push({ role: 'bot', text: botText });
    }

    // If new prompt submitted
    if (context.request.method === 'POST') {
      log.debug('Incoming Request Data 1', JSON.stringify(context.request.parameters));
      const prompt = context.request.parameters.custpage_text;
      log.debug('Incoming Request Data 2', prompt);

      const promptField = form.addField({
        id: 'custpage_hist' + historySize,
        type: serverWidget.FieldType.TEXTAREA,
        label: 'You',
        container: 'chatgroup'
      });
      promptField.defaultValue = prompt;
      promptField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });
      chatHistory.push({ role: 'user', text: prompt });

      // 🔹 LLM Call
      let llmJson = {};
      try {
        const response = llm.generateText({
          preamble: `You are an expert in Warehouse Management. Your task is to extract the following fields(if mentioned) from the user's query when explicitly or implicitly mentioned:
                      - location: The warehouse location (e.g., Buffalo, NY)
                      - orderType: Type of order (e.g., Sales Order, Purchase Order, Transfer Order)
                      - statusType: Status of the order (e.g., Pending Approval, Pending Receipt, Partially Received, Closed etc.)
                      - Time: if user mentions a time or day or anything related to to time, extract it as MM/DD/YYYY format.
                      - Subsidiary: if user mentions a subsidiary, extract it.
                      - Vendor: if user mentions a vendor, extract it.
                      - lineitem: if user mentions a item extract it.(eg: coke).

                      If no fields are mentioned, try to infer at least "orderType". If nothing at all can be inferred, return an empty JSON.
                      Do not include any explanation, just the JSON.

                      {
                        "location": "Buffalo, NY",
                        "orderType": "Purchase Order",
                        "statusType": "Pending Approval",
                        "time": "MM/DD/YYYY",
                        "subsidiary": "Subsidiary Name",
                        "vendor": "Vendor Name",
                        "lineitem": "Item Name"
                      }`,
          prompt: prompt,
          modelFamily: llm.ModelFamily.COHERE_COMMAND_R_PLUS,
          modelParameters: {
            maxTokens: 1000,
            temperature: 0,
            topK: 0,
            topP: 1,
            frequencyPenalty: 0,
            presencePenalty: 0
          }
        });
        log.debug('LLM Response', JSON.stringify(response));
        const match = response.text.match(/\{[\s\S]*\}/);
        llmJson = match ? JSON.parse(match[0]) : { error: 'Invalid JSON' };
      } catch (e) {
        llmJson = { error: 'LLM failed' };
      }

      log.debug('Incoming Request Data 3', JSON.stringify(llmJson));

      let botReply = '';
      if (llmJson.error) {
        botReply = JSON.stringify(llmJson);
      } else {
        // Dispatch to PO handler
        const orderType = (llmJson.orderType || '').toLowerCase();
        if (orderType === 'purchase order') {
          log.debug('Incoming Request Data 2', JSON.stringify(orderType));
          const result = poHandler.handle(llmJson);
          botReply = JSON.stringify(result, null, 2);
        } else {
          botReply = 'Only Purchase Orders are supported at the moment.';
        }
      }

      const botField = form.addField({
        id: 'custpage_hist' + (historySize + 1),
        type: serverWidget.FieldType.TEXTAREA,
        label: 'ChatBot',
        container: 'chatgroup'
      });
      botField.defaultValue = botReply;
      botField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });
      chatHistory.push({ role: 'bot', text: botReply });

      numChats.defaultValue = (historySize + 2).toString();
    }

    form.addField({
      id: 'custpage_text',
      type: serverWidget.FieldType.TEXTAREA,
      label: 'Prompt',
      container: 'chatgroup'
    });

    form.addSubmitButton({ label: 'Submit' });
    context.response.writePage(form);
  }

  return { onRequest };
});
