/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @Filename testSuitelet.js
 * @Description Suitelet to test List-wise PO Summary Generator
 */

define([
    'N/ui/serverWidget',
    'N/log',
    './Popup/handlers/poListSummary.js'
], function (serverWidget, log, poListSummary) {

    function onRequest(context) {
        if (context.request.method === 'GET') {
            try {
                const form = serverWidget.createForm({ title: 'PO List Summary Tester' });

                // Call your summary generator
                const summary = poListSummary.generateListSummary();

                // Add a large field to show the summary
                const summaryField = form.addField({
                    id: 'custpage_summary_output',
                    type: serverWidget.FieldType.LONGTEXT,
                    label: 'Generated Summary'
                });

                summaryField.defaultValue = summary;
                summaryField.updateDisplaySize({ height: 30, width: 100 });
                summaryField.updateBreakType({ breakType: serverWidget.FieldBreakType.STARTCOL });
                summaryField.updateLayoutType({ layoutType: serverWidget.FieldLayoutType.OUTSIDEABOVE });
                summaryField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });

                context.response.writePage(form);
            } catch (e) {
                log.error('Summary Generation Error', e);
                context.response.write('Error: ' + e.message);
            }
        }
    }

    return {
        onRequest: onRequest
    };
});
