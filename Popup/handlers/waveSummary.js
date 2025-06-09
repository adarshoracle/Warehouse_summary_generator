/**
 * waveSummary.js
 * Handler module for generating wave record summaries in NetSuite.
 */

define(['N/record', 'N/log', 'N/llm'], function (record, log, llm) {

    function waveSummary(recordId) {
        try {
            var rec = record.load({
                type: 'wave', // Replace with actual wave record type
                id: recordId
            });

            // Primary Information
            var waveNumber = rec.getValue({ fieldId: 'name' });
            var status = rec.getText({ fieldId: 'status' });
            var location = rec.getText({ fieldId: 'location' });
            var createdDate = rec.getValue({ fieldId: 'createddate' });

            var primaryInfoSummary = `Wave Number: ${waveNumber}
                                        Status: ${status}
                                        Location: ${location}
                                        Created Date: ${createdDate}`;

            // Orders Sublist
            var orderCount = rec.getLineCount({ sublistId: 'waveorders' });
            var orders = [];
            for (var i = 0; i < orderCount; i++) {
                var orderId = rec.getSublistText({
                    sublistId: 'waveorder',
                    fieldId: 'custrecord_wave_order_so', // Sales Order #
                    line: i
                });

                var orderDate = rec.getSublistValue({
                    sublistId: 'waveorder',
                    fieldId: 'custrecord_wave_order_date', // Date
                    line: i
                });

                var customer = rec.getSublistText({
                    sublistId: 'waveorder',
                    fieldId: 'custrecord_wave_order_customer',
                    line: i
                });

                var memo = rec.getSublistValue({
                    sublistId: 'waveorder',
                    fieldId: 'custrecord_wave_order_memo',
                    line: i
                });

                var qtyBase = rec.getSublistValue({
                    sublistId: 'waveorder',
                    fieldId: 'custrecord_wave_order_qty_base',
                    line: i
                });

                orders.push({
                    orderId: orderId,
                    orderDate: orderDate,
                    customer: customer,
                    memo: memo,
                    qtyBase: qtyBase
                });
            }
            var ordersSummary = `Orders (${orderCount}):\n${orders.join('\n')}`;

            // Line Items Sublist
            var lineItemCount = rec.getLineCount({ sublistId: 'recmachcustrecord_wave_lineitem' });
            var lineItems = [];
            for (var j = 0; j < lineItemCount; j++) {
                var itemName = rec.getSublistText({
                    sublistId: 'recmachcustrecord_wave_lineitem',
                    fieldId: 'custrecord_wave_item_name',
                    line: j
                });
                var quantityOrdered = rec.getSublistValue({
                    sublistId: 'recmachcustrecord_wave_lineitem',
                    fieldId: 'custrecord_wave_qty_ordered',
                    line: j
                });
                var quantityPicked = rec.getSublistValue({
                    sublistId: 'recmachcustrecord_wave_lineitem',
                    fieldId: 'custrecord_wave_qty_picked',
                    line: j
                });
                lineItems.push(`- Item: ${itemName}, Ordered: ${quantityOrdered}, Picked: ${quantityPicked}`);
            }
            var lineItemsSummary = `Line Items (${lineItemCount}):\n${lineItems.join('\n')}`;

            // Pick Tasks Sublist
            var pickTaskCount = rec.getLineCount({ sublistId: 'recmachcustrecord_wave_picktask' });
            var pickTasks = [];
            for (var k = 0; k < pickTaskCount; k++) {
                var taskNumber = rec.getSublistText({
                    sublistId: 'recmachcustrecord_wave_picktask',
                    fieldId: 'custrecord_wave_picktask_number',
                    line: k
                });
                var taskStatus = rec.getSublistText({
                    sublistId: 'recmachcustrecord_wave_picktask',
                    fieldId: 'custrecord_wave_picktask_status',
                    line: k
                });
                pickTasks.push(`- Task: ${taskNumber} (Status: ${taskStatus})`);
            }
            var pickTasksSummary = `Pick Tasks (${pickTaskCount}):\n${pickTasks.join('\n')}`;

            // System Info Sublist
            var sysInfoCount = rec.getLineCount({ sublistId: 'recmachcustrecord_wave_sysinfo' });
            var sysInfoEntries = [];
            for (var m = 0; m < sysInfoCount; m++) {
                var infoKey = rec.getSublistText({
                    sublistId: 'recmachcustrecord_wave_sysinfo',
                    fieldId: 'custrecord_wave_sysinfo_key',
                    line: m
                });
                var infoValue = rec.getSublistText({
                    sublistId: 'recmachcustrecord_wave_sysinfo',
                    fieldId: 'custrecord_wave_sysinfo_value',
                    line: m
                });
                sysInfoEntries.push(`- ${infoKey}: ${infoValue}`);
            }
            var sysInfoSummary = `System Info (${sysInfoCount}):\n${sysInfoEntries.join('\n')}`;

            // Combine all summaries into prompt
            var fullPrompt = `You are an expert in warehouse wave summaries.

                                Primary Information:
                                ${primaryInfoSummary}

                                Orders:
                                ${ordersSummary}

                                Line Items:
                                ${lineItemsSummary}

                                Pick Tasks:
                                ${pickTasksSummary}

                                System Info:
                                ${sysInfoSummary}

                                Please generate a professional, concise, and insightful summary including:
                                - Status overview
                                - Progress of pick tasks
                                - Any notable exceptions or delays
                                - Overall wave completion status.
                                `;

            const summary = llm.generateText({
                preamble: 'You are an expert in warehouse wave summaries.',
                prompt: fullPrompt,
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

            return { summary: summary };

        } catch (e) {
            log.error('waveSummary Error', e);
            return { summary: 'Error generating wave summary.' };
        }
    }

    return {
        waveSummary: waveSummary
    };
});
