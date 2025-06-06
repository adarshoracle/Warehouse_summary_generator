/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

define(['N/ui/serverWidget', 'N/log', './cache/poFieldCache.js'], (serverWidget, log, poCache) => {
  function onRequest(context) {
    const form = serverWidget.createForm({ title: 'Test Purchase Order Field Cache' });

    // Collect all maps
    const maps = {
      Locations: poCache.getLocationMap(),
      Vendors: poCache.getVendorMap(),
      Statuses: poCache.getStatusMap(),
      Subsidiaries: poCache.getSubsidiaryMap(),
      Departments: poCache.getDepartmentMap(),
      Classes: poCache.getClassMap()
    };

    // Build display output
    let display = '';
    for (const label in maps) {
      const map = maps[label];
      display += `=== ${label} ===\n`;
      for (const name in map) {
        display += `${name} → ${map[name]}\n`;
      }
      display += '\n';
    }

    // Add field to display results
    form.addField({
      id: 'custpage_output',
      label: 'PO Field Cache Output',
      type: serverWidget.FieldType.LONGTEXT
    }).defaultValue = display;

    context.response.writePage(form);
  }

  return { onRequest };

});
