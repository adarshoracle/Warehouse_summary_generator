/**
 * @NApiVersion 2.1
 */

define(['N/search'], (search) => {
  function getLocationMap() {
    const map = {};
    const locationSearch = search.create({
      type: search.Type.LOCATION,
      filters: [['isinactive', 'is', 'F']],
      columns: ['internalid', 'name']
    });

    locationSearch.run().each(result => {
      const name = result.getValue('name');
      const id = result.getValue('internalid');
      map[name.toLowerCase()] = id;
      return true;
    });

    return map;
  }

  function getVendorMap() {
    const map = {};
    const vendorSearch = search.create({
      type: search.Type.VENDOR,
      filters: [['isinactive', 'is', 'F']],
      columns: ['internalid', 'entityid']
    });

    vendorSearch.run().each(result => {
      const name = result.getValue('entityid');
      const id = result.getValue('internalid');
      map[name.toLowerCase()] = id;
      return true;
    });

    return map;
  }

  function getStatusMap() {
    const map = {};
    const statusSearch = search.create({
      type: search.Type.TRANSACTION,
      filters: [['type', 'anyof', 'PurchOrd']],
      columns: [
        search.createColumn({ name: 'status', summary: search.Summary.GROUP })
      ]
    });

    statusSearch.run().each(result => {
      const label = result.getText({ name: 'status', summary: search.Summary.GROUP });
      const value = result.getValue({ name: 'status', summary: search.Summary.GROUP });
      if (label && value) map[label.toLowerCase()] = value;
      return true;
    });

    return map;
  }

  function getSubsidiaryMap() {
    const map = {};
    const subSearch = search.create({
      type: search.Type.SUBSIDIARY,
      filters: [['isinactive', 'is', 'F']],
      columns: ['internalid', 'name']
    });

    subSearch.run().each(result => {
      const name = result.getValue('name');
      const id = result.getValue('internalid');
      map[name.toLowerCase()] = id;
      return true;
    });

    return map;
  }

  function getDepartmentMap() {
    const map = {};
    const deptSearch = search.create({
      type: search.Type.DEPARTMENT,
      filters: [['isinactive', 'is', 'F']],
      columns: ['internalid', 'name']
    });

    deptSearch.run().each(result => {
      const name = result.getValue('name');
      const id = result.getValue('internalid');
      map[name.toLowerCase()] = id;
      return true;
    });

    return map;
  }

  function getClassMap() {
    const map = {};
    const classSearch = search.create({
      type: search.Type.CLASSIFICATION,
      filters: [['isinactive', 'is', 'F']],
      columns: ['internalid', 'name']
    });

    classSearch.run().each(result => {
      const name = result.getValue('name');
      const id = result.getValue('internalid');
      map[name.toLowerCase()] = id;
      return true;
    });

    return map;
  }

  return {
    getLocationMap,
    getVendorMap,
    getStatusMap,
    getSubsidiaryMap,
    getDepartmentMap,
    getClassMap
  };
});
