/**
 * @NApiVersion 2.1
 */

define(['N/search', './cache/poFieldCache', 'N/log'], (search, cache, log) => {
  function handle(filtersJson) {
    log.debug({
        title: 'LLM JSON Received',
        details: JSON.stringify(filtersJson)
    });
    const filters = [['mainline', 'is', 'T']];
    const mapLocation = cache.getLocationMap();
    const mapVendor = cache.getVendorMap();
    const mapStatus = cache.getStatusMap();
    const mapSubsidiary = cache.getSubsidiaryMap();
    const mapDepartment = cache.getDepartmentMap();
    const mapClass = cache.getClassMap();

    if (filtersJson.location) {
      const id = mapLocation[filtersJson.location.toLowerCase()];
      if (id)
        filters.push('AND', ['location', 'anyof', id]);
    }

    if (filtersJson.vendor) {
      const id = mapVendor[filtersJson.vendor.toLowerCase()];
      if (id)
        filters.push('AND', ['entity', 'anyof', id]);
    }

    if (filtersJson.statusType) {
      const id = mapStatus[filtersJson.statusType.toLowerCase()];
      if (id)
        filters.push('AND', ['status', 'anyof', id]);
    }

    if (filtersJson.department) {
      const id = mapDepartment[filtersJson.department.toLowerCase()];
      if (id)
        filters.push('AND', ['department', 'anyof', id]);
    }

    if (filtersJson.class) {
      const id = mapClass[filtersJson.class.toLowerCase()];
      if (id)
        filters.push('AND', ['class', 'anyof', id]);
    }

    if (filtersJson.time) {
      filters.push('AND', ['trandate', 'onorafter', filtersJson.time]);
    }

    if (filtersJson.subsidiary) {
      const id = mapSubsidiary[filtersJson.subsidiary.toLowerCase()];
      if (id)
        filters.push('AND', ['subsidiary', 'anyof', id]);
    }

    const results = search.create({
      type: search.Type.PURCHASE_ORDER,
      filters,
      columns: ['tranid', 'location', 'entity', 'status', 'trandate', 'subsidiary', 'class', 'department']
    }).run().getRange({ start: 0, end: 15 });

    const summary = results.map((res, idx) => ({
      '#': idx + 1,
      id: res.getValue('tranid'),
      location: res.getText('location'),
      entity: res.getText('entity'),
      status: res.getText('status'),
      date: res.getValue('trandate'),
      subsidiary: res.getText('subsidiary'),
      class: res.getText('class'),
      department: res.getText('department')
    }));

    return {
      extractedFilters: filtersJson,
      totalResults: summary.length,
      results: summary
    };
  }

  return { handle };
});