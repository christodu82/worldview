// An array of layers that we want to measure in EIC mode
export const layersToMeasure = [
  'MODIS_Terra_CorrectedReflectance_TrueColor',
  'VIIRS_SNPP_DayNightBand_At_Sensor_Radiance',
  'VIIRS_SNPP_CorrectedReflectance_TrueColor',
  'GHRSST_L4_MUR_Sea_Surface_Temperature',
  'MODIS_Aqua_Land_Surface_Temp_Day',
  'MODIS_Aqua_CorrectedReflectance_TrueColor',
  'IMERG_Precipitation_Rate',
  'GOES-East_ABI_GeoColor',
  'GOES-West_ABI_GeoColor',
  'Himawari_AHI_Band3_Red_Visible_1km',
  'AMSRU2_Sea_Ice_Concentration_12km',
  'OMI_Nitrogen_Dioxide_Tropo_Column',
  'VIIRS_SNPP_AOT_Dark_Target_Land_Ocean',
  'VIIRS_SNPP_AOT_Deep_Blue_Best_Estimate',
  'AIRS_L3_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Daily_Night',
  'AIRS_L3_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Daily_Day',
  'VIIRS_NOAA20_CorrectedReflectance_TrueColor',
  'CERES_EBAF_TOA_Shortwave_Flux_All_Sky_Monthly',

];

// Object that contains the black pixel % threshold for each layer
// Threshold values represent the amount of black pixels as a percentage that CAN be present in an image
export const layerPixelData = {
  MODIS_Terra_CorrectedReflectance_TrueColor: { threshold: 0.70 },
  VIIRS_SNPP_DayNightBand_At_Sensor_Radiance: { threshold: 0.70 },
  VIIRS_SNPP_CorrectedReflectance_TrueColor: { threshold: 0.65 },
  IMERG_Precipitation_Rate: { threshold: 0.95 },
  GHRSST_L4_MUR_Sea_Surface_Temperature: { threshold: 0.65 },
  MODIS_Aqua_Land_Surface_Temp_Day: { threshold: 0.80 },
  MODIS_Aqua_CorrectedReflectance_TrueColor: { threshold: 0.50 },
  'GOES-East_ABI_GeoColor': { threshold: 0.76 },
  'GOES-West_ABI_GeoColor': { threshold: 0.76 },
  Himawari_AHI_Band3_Red_Visible_1km: { threshold: 0.76 },
  AMSRU2_Sea_Ice_Concentration_12km: { threshold: 0.85 },
  OMI_Nitrogen_Dioxide_Tropo_Column: { threshold: 0.50 },
  VIIRS_SNPP_AOT_Dark_Target_Land_Ocean: { threshold: 0.95 },
  VIIRS_SNPP_AOT_Deep_Blue_Best_Estimate: { threshold: 0.95 },
  AIRS_L3_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Daily_Night: { threshold: 0.20 },
  AIRS_L3_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Daily_Day: { threshold: 0.20 },
  VIIRS_NOAA20_CorrectedReflectance_TrueColor: { threshold: 0.65 },
  CERES_EBAF_TOA_Shortwave_Flux_All_Sky_Monthly: { threshold: 0.01 },
};

// Back-up dates for each layer in case no date is found that satisfies the full imagery threshold
// TO DO: These layers will eventually need to be prioritized if a scenario has layers from multiple best dates
export const bestDates = {
  'GOES-East_ABI_GeoColor': { date: '2023-10-30T23:50:00.000Z' },
  'GOES-West_ABI_GeoColor': { date: '2023-10-30T23:50:00.000Z' },
  Himawari_AHI_Band3_Red_Visible_1km: { date: '2023-10-30T23:50:00.000Z' },
  MODIS_Terra_CorrectedReflectance_TrueColor: { date: '2023-10-29' },
  VIIRS_SNPP_DayNightBand_At_Sensor_Radiance: { date: '2023-10-30' },
  VIIRS_SNPP_CorrectedReflectance_TrueColor: { date: '2023-10-30' },
  IMERG_Precipitation_Rate: { date: '2023-10-30' },
  GHRSST_L4_MUR_Sea_Surface_Temperature: { date: '2023-10-30' },
  MODIS_Aqua_Land_Surface_Temp_Day: { date: '2023-10-30' },
  MODIS_Aqua_CorrectedReflectance_TrueColor: { date: '2023-10-29' },
  OMI_Nitrogen_Dioxide_Tropo_Column: { date: '2023-10-27' },
  VIIRS_SNPP_AOT_Dark_Target_Land_Ocean: { date: '2023-10-29' },
  VIIRS_SNPP_AOT_Deep_Blue_Best_Estimate: { date: '2023-10-30' },
  AIRS_L3_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Daily_Night: { date: '2023-10-17' },
  AIRS_L3_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Daily_Day: { date: '2023-10-17' },
  VIIRS_NOAA20_CorrectedReflectance_TrueColor: { date: '2023-10-30' },
  CERES_EBAF_TOA_Shortwave_Flux_All_Sky_Monthly: { date: '2023-10-30' },
};

export const travelModeData = {
  "1": {
    title: 'True Color Imagery from Terra Satellite'
  },
  "2": {
    title: 'Geostationary imagery from NOAA and JAXA satellites'
  },
  "3": {
    title: 'Active fires detected by Suomi NPP satellite'
  },
  "4": {
    title: 'Black Marble Night Time Imaging from Suomi NPP Satellite'
  },
  "5": {
    title: 'Rain and Snow'
  },
  "6": {
    title: 'Sea Surface Temperature'
  },
  "7": {
    title: 'Land Surface Temperature'
  },
  "8": {
    title: 'Arctic Sea Ice'
  },
  "9": {
    title: 'Antarctic Sea Ice'
  },
  "10": {
    title: 'VIIRS/Suomi NPP fires & VIRRS True Color Corrected Reflectance'
  },
  "11": {
    title: 'Aura/OMI Nitrogen Dioxide and VIIRS/NOAA-20 True Color Corrected Reflectance'
  },
  "12": {
    title: 'Aqua/AIRS Carbon Monoxide Day and Night + Borders and coastlines'
  },
  "13": {
    title: 'VIIRS/Suomi NPP Aerosol Optical Depth Dark Target and Deep Blue & True Color Corrected Reflectance'
  },
}