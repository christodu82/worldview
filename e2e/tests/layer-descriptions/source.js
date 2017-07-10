module.exports = {
  'Layer Descriptions - Measurment source ("Add Layers" Categories / All / Aerosol Optical Depth / Terra/MODIS)' : function (browser) {
    browser.url(browser.globals.url).pause(1000);
    browser.waitForElementVisible('#skipTour', 10000, function (el) {
      browser.click('#skipTour');

      // Check to see if 'Add Layers' Button is present and click to open it
      browser.expect.element('#layers-add').to.be.present;
      browser.click('#layers-add').pause(500);
      browser.waitForElementVisible('#layer-modal-main', 5000, function(el) {

        // Click the first layer category under Air Quality category.
        // TODO: Change to explicitly click the Aerosol Optical Layers
        browser.click('#layer-categories #air-quality .layer-category-item:first-child').pause(500);

      });
    });
    browser.end();
  }
};
