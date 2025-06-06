/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

define(['N/ui/serverWidget', 'N/llm', 'N/search', 'N/log'], (serverWidget, llm, search, log) => {
  function onRequest(context) {
    const form = serverWidget.createForm({ title: 'Warehouse Chat Bot' });

    const fieldgroup = form.addFieldGroup({
      id: 'fieldgroupid',
      label: 'Chat'
    });
    fieldgroup.isSingleColumn = true;

    const historySize = parseInt(context.request.parameters.custpage_num_chats || '0', 10);
    const numChats = form.addField({
      id: 'custpage_num_chats',
      type: serverWidget.FieldType.INTEGER,
      container: 'fieldgroupid',
      label: 'History Size'
    });
    numChats.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

    const chatHistory = [];

    if (context.request.method === 'POST') {
      // Re-add previous chat history
      for (let i = 0; i < historySize; i += 2) {
        const userFieldId = 'custpage_hist' + i;
        const botFieldId = 'custpage_hist' + (i + 1);

        const userText = context.request.parameters[userFieldId];
        const botText = context.request.parameters[botFieldId];

        const userField = form.addField({
          id: userFieldId,
          type: serverWidget.FieldType.TEXTAREA,
          label: 'You',
          container: 'fieldgroupid'
        });
        userField.defaultValue = userText;
        userField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });

        const botField = form.addField({
          id: botFieldId,
          type: serverWidget.FieldType.TEXTAREA,
          label: 'ChatBot',
          container: 'fieldgroupid'
        });
        botField.defaultValue = botText;
        botField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });

        chatHistory.push({ role: llm.ChatRole.USER, text: userText });
        chatHistory.push({ role: llm.ChatRole.CHATBOT, text: botText });
      }

      const prompt = context.request.parameters.custpage_text;

      // Add current user prompt
      const newUserFieldId = 'custpage_hist' + historySize;
      const promptField = form.addField({
        id: newUserFieldId,
        type: serverWidget.FieldType.TEXTAREA,
        label: 'You',
        container: 'fieldgroupid'
      });
      promptField.defaultValue = prompt;
      promptField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });

      chatHistory.push({ role: llm.ChatRole.USER, text: prompt });

      // Call LLM
      let llmResponseText = '';
      try {
        const llmResponse = llm.generateText({
          preamble: `You are an expert in Warehouse Management. Your task is to extract the following fields from the user's query when explicitly or implicitly mentioned:

- location: The warehouse location (e.g., Buffalo, NY)
- orderType: Type of order (e.g., Sales Order, Purchase Order, Transfer Order)
- statusType: Status of the order (e.g., Pending Approval, Pending Receipt, Partially Received, Closed etc.)
- Time: if user mentions a time or day or anything related to to time, extract it as MM/DD/YYYY format.
- Subsidiary: if user mentions a subsidiary, extract it.
- Vendor: if user mentions a vendor, extract it.
- lineitem: if user mentions a item extract it.(eg: coke).

give everything dont leave any single detail because every detail is important for filtering.
Respond **only** with a single JSON object in the following format:

{
  "location": "Buffalo, NY",
  "orderType": "Purchase Order",
  "statusType": "Pending Approval",
  "time": "MM/DD/YYYY",
  "subsidiary": "Subsidiary Name",
  "vendor": "Vendor Name",
  "lineitem": "Item Name"
}

Omit fields not mentioned in the query. Do not include any explanation, just the JSON.`,
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

        llmResponseText = llmResponse.text;
      } catch (e) {
        llmResponseText = JSON.stringify({ error: 'LLM call failed' });
      }

      let responseJson = {};
      try {
        const jsonMatch = llmResponseText.match(/\{[\s\S]*\}/);
        responseJson = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Invalid JSON format' };
      } catch (e) {
        responseJson = { error: 'Error parsing LLM response' };
      }

      let output = '';
      let filters = [];
      let itemCount = 0;
      const itemNames = [];
      if(!responseJson.lineitem){
      filters.push(['mainline', 'is', 'T']);}

      if (!responseJson.error) {
        // Add location filter
        if (responseJson.location) {
          const locationSearch = search.create({
            type: search.Type.LOCATION,
            filters: [['name', 'is', responseJson.location]],
            columns: ['internalid']
          });

          const locationResults = locationSearch.run().getRange({ start: 0, end: 1 });
          if (locationResults.length > 0) {
            const locationId = locationResults[0].getValue('internalid');
            filters.push(['location', 'anyof', locationId]);
            log.debug('locationid', locationId);
          }
        }

        // Add order type filter
        if (responseJson.orderType) {
          const transactionTypeMap = {
            'Sales Order': 'SalesOrd',
            'Purchase Order': 'PurchOrd',
            'Transfer Order': 'TrnfrOrd'
          };
          const typeFilter = transactionTypeMap[responseJson.orderType];
          if (typeFilter) {
            if (filters.length) filters.push('AND');
            filters.push(['type', 'anyof', typeFilter]);
            log.debug('typeFilter', typeFilter);
          }
        }

        // Add status filter
        if (responseJson.statusType) {
          const statusTypeMap = {
            'Pending Approval': 'PurchOrd:A',
            'Pending Receipt': 'PurchOrd:B',
            'Partially Received': 'PurchOrd:C',
            'Pending Billing/Partially Received': 'PurchOrd:D',
            'Pending Billing': 'PurchOrd:E',
            'Billed': 'PurchOrd:F',
            'Closed': 'PurchOrd:H',
          };
          const statusFilter = statusTypeMap[responseJson.statusType];
          if (statusFilter) {
            if (filters.length) filters.push('AND');
            filters.push(['status', 'anyof', statusFilter]);
            log.debug('statusFilter', statusFilter);
          }
        }

        if(responseJson.time){
          const timeFilter = responseJson.time;
          if(filters.length) filters.push('AND');
          filters.push(['trandate','onorafter', timeFilter]);
        }

        if(responseJson.subsidiary){
           const subsidiarySearch = search.create({
            type: search.Type.SUBSIDIARY,
            filters: [['name', 'is', responseJson.subsidiary]],
            columns: ['internalid']
           });
           const subsidiaryResults = subsidiarySearch.run().getRange({start: 0, end: 1});
           if(subsidiaryResults.length > 0)
           {
            const subsidiaryId = subsidiaryResults[0].getValue('internalid');
            if(filters.length) filters.push('AND');
            filters.push(['subsidiary','anyof',subsidiaryId]);
            log.debug('subsidiaryId', subsidiaryId);

           }
        }
        
        if(responseJson.vendor){
          const vendorSearch = search.create({
            type: search.Type.VENDOR,
            filters: [['entityid', 'is', responseJson.vendor]],
            columns: ['internalid']
          });
          const vendorResults = vendorSearch.run().getRange({start: 0, end: 1});
          if(vendorResults.length > 0)
          {
            const vendorId = vendorResults[0].getValue('internalid');
            if(filters.length) filters.push('AND');
            filters.push(['entity','anyof',vendorId]);
            log.debug('vendorId', vendorId);
          }

        }

        // there is an error in this have to check tomorrow.............
        if(responseJson.lineitem)
        {
          const itemSearch = search.create({
            type: search.Type.ITEM,
            filters: [['name','is', responseJson.lineitem]],
            columns: ['internalid']
          });
          const itemResults = itemSearch.run().getRange({start:0, end: 1});
          if(itemResults.length > 0)
          {
            const itemId = itemResults[0].getValue('internalid');
            if(filters.length) filters.push('AND');
            filters.push(['item','anyof',itemId]);
            log.debug('itemId', itemId);
          }
        }


        log.debug('Order Search Filters', JSON.stringify(filters));
        
            
        const orderSearch = search.create({
          type: search.Type.TRANSACTION,
          filters: filters,
          columns: ['tranid', 'location', 'entity', 'type', 'status', 'trandate', 'subsidiary']
        });

        const results = orderSearch.run().getRange({ start: 0, end: 10 });

        if (results.length > 0) {
          output += 'Results:\n\n';
          results.forEach((res, i) => {
            const tranId = res.getValue('tranid');
            const location = res.getText('location') || 'N/A';
            const entity = res.getText('entity') || 'N/A';
            const type = res.getText('type') || 'N/A';
            const status = res.getText('status') || 'N/A';
            const tranDate = res.getValue('trandate') || 'N/A';
            const subsidiary = res.getText('subsidiary') || 'N/A';

            output += `#${i + 1}\n`;
            output += `Transaction ID: ${tranId}\n`;
            // output += `Type          : ${type}\n`;
            // output += `Status        : ${status}\n`;
            // output += `Entity        : ${entity}\n`;
            // output += `Location      : ${location}\n`;
            // output += `Date          : ${tranDate}\n`;
            // output += `Subsidiary    : ${subsidiary}\n`;
            // output += `-----------------------------\n`;

            itemNames.push(tranId);
            itemCount++;
          });
        } else {
          output = 'No matching orders found.';
        }

       // Add system-level context and summary prompt
const summaryPrompt = `
You are a warehouse operations assistant. Based on the extracted filters and data below, generate a concise and useful summary of the results. Mention total orders, key patterns (if any), and make it actionable or informative.

Extracted Filters:
${JSON.stringify(responseJson, null, 2)}

Order Data:
${output}
`;

const summaryResponse = llm.generateText({
  preamble: `You are a helpful assistant that summarizes order information for a warehouse team.`,
  prompt: summaryPrompt,
  modelFamily: llm.ModelFamily.COHERE_COMMAND_R_PLUS,
  modelParameters: {
    maxTokens: 1000,
    temperature: 0.3,
    topK: 0,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0
  }
}).text;

// Add both raw and summarized info to chat history
chatHistory.push({
  role: llm.ChatRole.CHATBOT,
  text: JSON.stringify({
    extractedFields: responseJson,
    totalItems: itemCount,
    summary: summaryResponse,
    itemnames: itemNames,
  }, null, 2)
});

      } else {
        chatHistory.push({
          role: llm.ChatRole.CHATBOT,
          text: `Error: ${responseJson.error}`
        });
      }

      // Add latest bot response
      const newBotFieldId = 'custpage_hist' + (historySize + 1);
      const botField = form.addField({
        id: newBotFieldId,
        type: serverWidget.FieldType.TEXTAREA,
        label: 'ChatBot',
        container: 'fieldgroupid'
      });
      botField.defaultValue = chatHistory[chatHistory.length - 1].text;
      botField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });

      numChats.defaultValue = (historySize + 2).toString();
    }

    // Prompt input for next question
    form.addField({
      id: 'custpage_text',
      type: serverWidget.FieldType.TEXTAREA,
      label: 'Prompt',
      container: 'fieldgroupid'
    });

    form.addSubmitButton({ label: 'Submit' });
    context.response.writePage(form);
  }

  return { onRequest };
});
