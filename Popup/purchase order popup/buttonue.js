/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/ui/serverWidget'], function (ui) {

    function beforeLoad(context) {
        if (context.type === context.UserEventType.VIEW) {
            const form = context.form;

            // Add button
            form.addButton({
                id: 'custpage_popup_btn',
                label: 'Show Summary',
                functionName: 'showSummary'
            });

            // Attach client script
            form.clientScriptModulePath = 'SuiteScripts/popup_client_script.js';
        }
    }

    return {
        beforeLoad: beforeLoad
    };
});
