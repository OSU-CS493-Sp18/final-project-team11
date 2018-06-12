module.exports = {
  /*
   * Performs data validation on an object by verifying that it contains
   * all required fields specified in a given schema.
   *
   * Returns true if the object is valid agianst the schema and false otherwise.
   */
  validateAgainstSchema: function (userData, compiledSchema) {
    var valid = compiledSchema(userData);
    if (!valid) console.log(compiledSchema.errors);
    return valid;
  }
};
