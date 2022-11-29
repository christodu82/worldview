/* eslint-disable import/no-duplicates */
/* eslint-disable no-multi-assign */
import OlTileGridWMTS from 'ol/tilegrid/WMTS';
import OlSourceWMTS from 'ol/source/WMTS';
import OlSourceTileWMS from 'ol/source/TileWMS';
import OlLayerGroup from 'ol/layer/Group';
import OlLayerTile from 'ol/layer/Tile';
import OlTileGridTileGrid from 'ol/tilegrid/TileGrid';
import MVT from 'ol/format/MVT';

import LayerVectorTile from 'ol/layer/VectorTile';
import SourceVectorTile from 'ol/source/VectorTile';

import lodashCloneDeep from 'lodash/cloneDeep';
import lodashMerge from 'lodash/merge';
import lodashEach from 'lodash/each';
import lodashGet from 'lodash/get';
import { Style, RegularShape } from 'ol/style';
import Stroke from 'ol/style/Stroke';
import Fill from 'ol/style/Fill';
import * as dat from 'dat.gui';
// import { Point } from 'proj4';
import WindTile from '../vectorflow/renderer.js';
import { throttle } from '../vectorflow/util';
import util from '../util/util';
import lookupFactory from '../ol/lookupimagetile';
import granuleLayerBuilder from './granule/granule-layer-builder';
import { getGranuleTileLayerExtent } from './granule/util';
import { createVectorUrl, getGeographicResolutionWMS, mergeBreakpointLayerAttributes } from './util';
import { datesInDateRanges, prevDateInDateRange } from '../modules/layers/util';
import { getSelectedDate } from '../modules/date/selectors';
import {
  isActive as isPaletteActive,
  getKey as getPaletteKeys,
  getLookup as getPaletteLookup,
} from '../modules/palettes/selectors';
import {
  isActive as isVectorStyleActive,
  getKey as getVectorStyleKeys,
  applyStyle,
} from '../modules/vector-styles/selectors';
import {
  nearestInterval,
} from '../modules/layers/util';

import {
  LEFT_WING_EXTENT, RIGHT_WING_EXTENT, LEFT_WING_ORIGIN, RIGHT_WING_ORIGIN, CENTER_MAP_ORIGIN,
} from '../modules/map/constants';


export default function mapLayerBuilder(config, cache, store) {
  const { getGranuleLayer } = granuleLayerBuilder(cache, store, createLayerWMTS);
  const renderAnimation = false;

  /**
   * Return a layer, or layergroup, created with the supplied function
   * @param {*} createLayerFunc
   * @param {*} def
   * @param {*} options
   * @param {*} attributes
   * @param {*} wrapLayer
   */
  const getLayer = (createLayerFunc, def, options, attributes, wrapLayer) => {
    const state = store.getState();
    const layer = createLayerFunc(def, options, null, state, attributes);
    layer.wv = attributes;
    if (!wrapLayer) {
      return layer;
    }
    const layerNext = createLayerFunc(def, options, 1, state, attributes);
    const layerPrior = createLayerFunc(def, options, -1, state, attributes);

    layerPrior.wv = attributes;
    layerNext.wv = attributes;
    return new OlLayerGroup({
      layers: [layer, layerNext, layerPrior],
    });
  };

  /**
   * For subdaily layers, if the layer date is within 30 minutes of current
   * time, set expiration to ten minutes from now
   */
  const getCacheOptions = (period, date) => {
    const tenMin = 10 * 60000;
    const thirtyMin = 30 * 60000;
    const now = Date.now();
    const recentTime = Math.abs(now - date.getTime()) < thirtyMin;
    if (period !== 'subdaily' || !recentTime) {
      return {};
    }
    return {
      expirationAbsolute: new Date(now + tenMin),
    };
  };

  /**
   * Create a new OpenLayers Layer Wrapper
   * @param {object} def
   * @param {object} key
   * @param {object} options
   * @param {object} dateOptions
   * @param {object} granuleAttributes // THIS PARAMETER IS NOT USED!
   * @returns {object} Openlayers TileLayer or LayerGroup
   */
  const createLayerWrapper = async (def, key, options, dateOptions) => {
    const state = store.getState();
    const { sidebar: { activeTab } } = state;
    const proj = state.proj.selected;
    const {
      breakPointLayer,
      id,
      opacity,
      period,
      projections,
      type,
      wrapadjacentdays,
      wrapX,
    } = def;
    const { nextDate, previousDate } = dateOptions;
    let { date } = dateOptions;
    let layer = cache.getItem(key);
    const isGranule = type === 'granule';

    if (!layer || isGranule) {
      if (!date) date = options.date || getSelectedDate(state);
      const cacheOptions = getCacheOptions(period, date);
      const attributes = {
        id,
        key,
        date,
        proj: proj.id,
        def,
        group: options.group,
        nextDate,
        previousDate,
      };
      def = lodashCloneDeep(def);
      lodashMerge(def, projections[proj.id]);
      if (breakPointLayer) def = mergeBreakpointLayerAttributes(def, proj.id);

      const isDataDownloadTabActive = activeTab === 'download';
      const wrapDefined = wrapadjacentdays === true || wrapX;
      const wrapLayer = proj.id === 'geographic' && !isDataDownloadTabActive && wrapDefined;
      if (!isGranule) {
        switch (def.type) {
          case 'wmts':
            layer = getLayer(createLayerWMTS, def, options, attributes, wrapLayer);
            break;
          case 'vector':
            layer = getLayer(createLayerVector, def, options, attributes, wrapLayer);
            break;
          case 'wms':
            layer = getLayer(createLayerWMS, def, options, attributes, wrapLayer);
            break;
          default:
            throw new Error(`Unknown layer type: ${type}`);
        }
        layer.wv = attributes;
        cache.setItem(key, layer, cacheOptions);
        layer.setVisible(false);
      } else {
        layer = await getGranuleLayer(def, attributes, options);
      }
    }
    layer.setOpacity(opacity || 1.0);
    return layer;
  };

  /**
   * Create a new OpenLayers Layer
   *
   * @method createLayer
   * @static
   * @param {object} def - Layer Specs
   * @param {object} options - Layer options
   * @returns {object} OpenLayers layer
   */
  const createLayer = async (def, options = {}) => {
    const state = store.getState();
    const { compare: { activeString } } = state;
    options.group = options.group || activeString;

    const {
      closestDate,
      nextDate,
      previousDate,
    } = getRequestDates(def, options);
    const date = closestDate;
    if (date) {
      options.date = date;
    }
    const dateOptions = { date, nextDate, previousDate };
    const key = layerKey(def, options, state);
    const layer = await createLayerWrapper(def, key, options, dateOptions);

    return layer;
  };

  /**
   * Returns the closest date, from the layer's array of availableDates
   *
   * @param  {object} def     Layer definition
   * @param  {object} options Layer options
   * @return {object}         Closest date
   */
  const getRequestDates = function(def, options) {
    const state = store.getState();
    const { date } = state;
    const { appNow } = date;
    const stateCurrentDate = new Date(getSelectedDate(state));
    const previousLayer = options.previousLayer || {};
    let closestDate = options.date || stateCurrentDate;

    let previousDateFromRange;
    let previousLayerDate = previousLayer.previousDate;
    let nextLayerDate = previousLayer.nextDate;

    const dateTime = closestDate.getTime();
    // if current date is outside previous and next available dates, recheck date range
    if (previousLayerDate && nextLayerDate
      && dateTime > previousLayerDate.getTime()
      && dateTime < nextLayerDate.getTime()
    ) {
      previousDateFromRange = previousLayerDate;
    } else {
      const { dateRanges, ongoing, period } = def;
      let dateRange;
      if (!ongoing) {
        dateRange = datesInDateRanges(def, closestDate);
      } else {
        let endDateLimit;
        let startDateLimit;

        let interval = 1;
        if (dateRanges && dateRanges.length > 0) {
          for (let i = 0; i < dateRanges.length; i += 1) {
            const d = dateRanges[i];
            const int = Number(d.dateInterval);
            if (int > interval) {
              interval = int;
            }
          }
        }

        if (period === 'daily') {
          endDateLimit = util.dateAdd(closestDate, 'day', interval);
          startDateLimit = util.dateAdd(closestDate, 'day', -interval);
        } else if (period === 'monthly') {
          endDateLimit = util.dateAdd(closestDate, 'month', interval);
          startDateLimit = util.dateAdd(closestDate, 'month', -interval);
        } else if (period === 'yearly') {
          endDateLimit = util.dateAdd(closestDate, 'year', interval);
          startDateLimit = util.dateAdd(closestDate, 'year', -interval);
        } else {
          endDateLimit = new Date(closestDate);
          startDateLimit = new Date(closestDate);
        }
        dateRange = datesInDateRanges(def, closestDate, startDateLimit, endDateLimit, appNow);
      }
      const { next, previous } = prevDateInDateRange(def, closestDate, dateRange);
      previousDateFromRange = previous;
      previousLayerDate = previous;
      nextLayerDate = next;
    }

    if (def.period === 'subdaily') {
      closestDate = nearestInterval(def, closestDate);
    } else if (previousDateFromRange) {
      closestDate = util.clearTimeUTC(previousDateFromRange);
    } else {
      closestDate = util.clearTimeUTC(closestDate);
    }

    return { closestDate, previousDate: previousLayerDate, nextDate: nextLayerDate };
  };

  /**
   * Create a layer key
   *
   * @function layerKey
   * @static
   * @param {Object} def - Layer properties
   * @param {number} options - Layer options
   * @param {boolean} precache // This does not align with the parameters of the layerKey function
   * @returns {object} layer key Object
   */
  const layerKey = (def, options, state) => {
    const { compare } = state;
    let date;
    const layerId = def.id;
    const projId = state.proj.id;
    let style = '';
    const activeGroupStr = options.group ? options.group : compare.activeString;

    // Don't key by time if this is a static layer
    if (def.period) {
      date = util.toISOStringSeconds(util.roundTimeOneMinute(options.date));
    }
    if (isPaletteActive(def.id, activeGroupStr, state)) {
      style = getPaletteKeys(def.id, undefined, state);
    }
    if (isVectorStyleActive(def.id, activeGroupStr, state)) {
      style = getVectorStyleKeys(def.id, undefined, state);
    }
    return [layerId, projId, date, style, activeGroupStr].join(':');
  };

  /**
   * Determine the extent based on TileMatrixSetLimits defined in GetCapabilities response
   * @param {*} matrixSet - from GetCapabilities
   * @param {*} matrixSetLimits - from GetCapabilities
   * @param {*} day
   * @param {*} proj - current projection
   */
  const calcExtentsFromLimits = (matrixSet, matrixSetLimits, day, proj) => {
    let extent;
    let origin;

    switch (day) {
      case 1:
        extent = LEFT_WING_EXTENT;
        origin = LEFT_WING_ORIGIN;
        break;
      case -1:
        extent = RIGHT_WING_EXTENT;
        origin = RIGHT_WING_ORIGIN;
        break;
      default:
        extent = proj.maxExtent;
        origin = [extent[0], extent[3]];
        break;
    }

    const resolutionLen = matrixSet.resolutions.length;
    const setlimitsLen = matrixSetLimits && matrixSetLimits.length;

    // If number of set limits doesn't match sets, we are assuming this product
    // crosses the anti-meridian and don't have a reliable way to calculate a single
    // extent based on multiple set limits.
    if (!matrixSetLimits || setlimitsLen !== resolutionLen || day) {
      return { origin, extent };
    }

    const limitIndex = resolutionLen - 1;
    const resolution = matrixSet.resolutions[limitIndex];
    const tileWidth = matrixSet.tileSize[0] * resolution;
    const tileHeight = matrixSet.tileSize[1] * resolution;
    const {
      minTileCol,
      maxTileRow,
      maxTileCol,
      minTileRow,
    } = matrixSetLimits[limitIndex];
    const minX = extent[0] + (minTileCol * tileWidth);
    const minY = extent[3] - ((maxTileRow + 1) * tileHeight);
    const maxX = extent[0] + ((maxTileCol + 1) * tileWidth);
    const maxY = extent[3] - (minTileRow * tileHeight);

    return {
      origin,
      extent: [minX, minY, maxX, maxY],
    };
  };

  /**
   * Create a new WMTS Layer
   * @method createLayerWMTS
   * @static
   * @param {object} def - Layer Specs
   * @param {object} options - Layer options
   * @param {number/null} day
   * @param {object} state
   * @returns {object} OpenLayers WMTS layer
   */
  function createLayerWMTS (def, options, day, state) {
    const { proj } = state;
    const {
      id, layer, format, matrixIds, matrixSet, matrixSetLimits, period, source, style, wrapadjacentdays, type,
    } = def;
    const configSource = config.sources[source];
    const { date, polygon, shifted } = options;
    const isSubdaily = period === 'subdaily';
    const isGranule = type === 'granule';

    if (!source) {
      throw new Error(`${id}: Invalid source: ${source}`);
    }
    const configMatrixSet = configSource.matrixSets[matrixSet];
    if (!configMatrixSet) {
      throw new Error(`${id}: Undefined matrix set: ${matrixSet}`);
    }

    let layerDate = date || getSelectedDate(state);
    if (isSubdaily && !layerDate) {
      layerDate = getRequestDates(def, options).closestDate;
      layerDate = new Date(layerDate.getTime());
    }
    if (day && wrapadjacentdays && !isSubdaily) {
      layerDate = util.dateAdd(layerDate, 'day', day);
    }

    const { tileMatrices, resolutions, tileSize } = configMatrixSet;
    const { origin, extent } = calcExtentsFromLimits(configMatrixSet, matrixSetLimits, day, proj.selected);
    const sizes = !tileMatrices ? [] : tileMatrices.map(({ matrixWidth, matrixHeight }) => [matrixWidth, matrixHeight]);

    // Also need to shift this if granule is shifted
    const tileGridOptions = {
      origin: shifted ? RIGHT_WING_ORIGIN : origin,
      extent: shifted ? RIGHT_WING_EXTENT : extent,
      sizes,
      resolutions,
      matrixIds: matrixIds || resolutions.map((set, index) => index),
      tileSize: tileSize[0],
    };

    const urlParameters = `?TIME=${util.toISOStringSeconds(util.roundTimeOneMinute(layerDate))}`;
    const sourceURL = def.sourceOverride || configSource.url;
    const sourceOptions = {
      url: sourceURL + urlParameters,
      layer: layer || id,
      cacheSize: 4096,
      crossOrigin: 'anonymous',
      format,
      transition: isGranule ? 350 : 0,
      matrixSet: configMatrixSet.id,
      tileGrid: new OlTileGridWMTS(tileGridOptions),
      wrapX: false,
      style: typeof style === 'undefined' ? 'default' : style,
    };
    if (isPaletteActive(id, options.group, state)) {
      const lookup = getPaletteLookup(id, options.group, state);
      sourceOptions.tileClass = lookupFactory(lookup, sourceOptions);
    }
    const tileSource = new OlSourceWMTS(sourceOptions);
    const granuleExtent = polygon && getGranuleTileLayerExtent(polygon, extent);

    return new OlLayerTile({
      extent: polygon ? granuleExtent : extent,
      preload: 0,
      source: tileSource,
    });
  }



  const animateVectors = function(layerName, tileSource, selected, layer) {
    const vectorLayers = ['ASCAT_Ocean_Surface_Wind_Speed', 'MISR_Cloud_Motion_Vector', 'OSCAR_Sea_Surface_Currents_Final_SD', 'OSCAR_Sea_Surface_Currents_Final_UV'];
    const animationAllowed = vectorLayers.indexOf(layerName) > -1;

    if (animationAllowed && renderAnimation) {
      const canvasElem = document.querySelectorAll('canvas');
      if (canvasElem.length > 0) {
        // Add z-index property to existing OL canvas. This ensures that the visualization is on the top layer.
        // The z-index should be applied with CSS on map generation to avoid this code entirely.
        canvasElem[0].style.zIndex = -1;
      }
      createWindtile(tileSource, selected, layer);
    }
  };


  /** Create a new Vector Layer
    *
    * @param {object} def - Layer Specs
    * @param {object} options - Layer options
    * @param {number} day
    * @param {object} state
    * @param {object} attributes
    * @returns {object} OpenLayers Vector layer
    */
  const createLayerVector = function(def, layeroptions, day, state, attributes) {
    console.log('createLayerVector');
    const { proj, animation, map: { ui: { selected } } } = state;
    let date;
    let gridExtent;
    let matrixIds;
    let start;
    let layerExtent;
    const selectedProj = proj.selected;
    const source = config.sources[def.source];
    const animationIsPlaying = animation.isPlaying;
    gridExtent = selectedProj.maxExtent;
    layerExtent = gridExtent;
    start = [selectedProj.maxExtent[0], selectedProj.maxExtent[3]];

    if (!source) {
      throw new Error(`${def.id}: Invalid source: ${def.source}`);
    }


    // These checks are for the misr_cloud_motion_vector layer
    // this is just to visualize the dataset from the demo instance so we can compare the demo to WV
    if (!source.matrixSets) {
      source.matrixSets = {
        '2km': {
          id: '2km',
          maxResolution: 0.5625,
          resolutions: [
            0.5625,
            0.28125,
            0.140625,
            0.0703125,
            0.03515625,
            0.017578125,
          ],
          tileSize: [
            512,
            512,
          ],
          tileMatrices: [
            {
              matrixWidth: 2,
              matrixHeight: 1,
            },
            {
              matrixWidth: 3,
              matrixHeight: 2,
            },
            {
              matrixWidth: 5,
              matrixHeight: 3,
            },
            {
              matrixWidth: 10,
              matrixHeight: 5,
            },
            {
              matrixWidth: 20,
              matrixHeight: 10,
            },
            {
              matrixWidth: 40,
              matrixHeight: 20,
            },
          ],
        },
      };
    }

    if (!def.matrixSet) {
      def.matrixSet = '2km';
    }
    // end of misr_cloud_motion_vector code

    const matrixSet = source.matrixSets[def.matrixSet];
    if (!matrixSet) {
      throw new Error(`${def.id}: Undefined matrix set: ${def.matrixSet}`);
    }
    if (typeof def.matrixIds === 'undefined') {
      matrixIds = [];
      lodashEach(matrixSet.resolutions, (resolution, index) => {
        matrixIds.push(index);
      });
    } else {
      matrixIds = def.matrixIds;
    }

    if (day) {
      if (day === 1) {
        layerExtent = LEFT_WING_EXTENT;
        start = CENTER_MAP_ORIGIN;
        gridExtent = [110, -90, 180, 90];
      } else {
        gridExtent = [-180, -90, -110, 90];
        layerExtent = RIGHT_WING_EXTENT;
        start = CENTER_MAP_ORIGIN;
      }
    }

    const layerName = def.layer || def.id;
    const tileMatrixSet = def.matrixSet;
    date = layeroptions.date || getSelectedDate(state);

    if (day && def.wrapadjacentdays) date = util.dateAdd(date, 'day', day);
    const urlParameters = createVectorUrl(date, layerName, tileMatrixSet);
    const wrapX = !!(day === 1 || day === -1);
    const breakPointLayerDef = def.breakPointLayer;
    const breakPointResolution = lodashGet(def, `breakPointLayer.projections.${proj.id}.resolutionBreakPoint`);
    const breakPointType = lodashGet(def, 'breakPointLayer.breakPointType');
    const isMaxBreakPoint = breakPointType === 'max';
    const isMinBreakPoint = breakPointType === 'min';

    const tileSource = new SourceVectorTile({
      url: source.url + urlParameters,
      layer: layerName,
      day,
      format: new MVT(),
      matrixSet: tileMatrixSet,
      wrapX,
      projection: proj.selected.crs,
      tileGrid: new OlTileGridTileGrid({
        extent: gridExtent,
        resolutions: matrixSet.resolutions,
        tileSize: matrixSet.tileSize,
        origin: start,
        sizes: matrixSet.tileMatrices,
      }),
    });

    let counter = 0;

    // ol.layer.VectorTile
    const layer = new LayerVectorTile({
      extent: layerExtent,
      source: tileSource,
      renderMode: 'vector',
      preload: 0,
      ...isMaxBreakPoint && { maxResolution: breakPointResolution },
      ...isMinBreakPoint && { minResolution: breakPointResolution },
      style (feature, resolution) {
        counter += 1;

        console.log(feature);


        // Due to processing issues, I am only rendering every 25th feature
        if (counter % 15 !== 0) return [];

        // This function styles each feature individually based on the feature specific data
        let arrowSizeMultiplier;
        let arrowColor;
        const radianDirection = feature.get('dir');
        const magnitude = feature.get('speed');

        // Adjust color & arrow length based on magnitude
        if (magnitude < 0.08) {
          arrowColor = 'red';
          arrowSizeMultiplier = 1;
        } else if (magnitude < 0.17) {
          arrowColor = 'blue';
          arrowSizeMultiplier = 1.25;
        } else {
          arrowColor = 'green';
          arrowSizeMultiplier = 1.5;
        }

        // The arrow shaft
        return [
          new Style({
            image: new RegularShape({
              points: 2,
              radius: 10 * arrowSizeMultiplier,
              stroke: new Stroke({
                width: 2,
                color: arrowColor,
              }),
              angle: radianDirection,
            }),
          }),
          // The arrow head
          new Style({
            image: new RegularShape({
              points: 3,
              radius: 5 * arrowSizeMultiplier,
              angle: radianDirection,
              fill: new Fill({
                color: arrowColor,
              }),
            }),
          }),
        ];
      },
    });

    applyStyle(def, layer, state, layeroptions);
    layer.wrap = day;
    layer.wv = attributes;
    layer.isVector = true;

    const vectorLayers = ['ASCAT_Ocean_Surface_Wind_Speed', 'MISR_Cloud_Motion_Vector', 'OSCAR_Sea_Surface_Currents_Final_SD', 'OSCAR_Sea_Surface_Currents_Final_UV'];
    const animationAllowed = vectorLayers.indexOf(layerName) > -1;
    if (animationAllowed && renderAnimation) {
      animateVectors(layerName, tileSource, selected, layer);
    }

    if (breakPointLayerDef && !animationIsPlaying) {
      const newDef = { ...def, ...breakPointLayerDef };
      const wmsLayer = createLayerWMS(newDef, layeroptions, day, state);
      const layerGroup = new OlLayerGroup({
        layers: [layer, wmsLayer],
      });
      wmsLayer.wv = attributes;
      return layerGroup;
    }

    if (breakPointResolution && animationIsPlaying) {
      delete breakPointLayerDef.projections[proj.id].resolutionBreakPoint;
      const newDef = { ...def, ...breakPointLayerDef };
      const wmsLayer = createLayerWMS(newDef, layeroptions, day, state);
      wmsLayer.wv = attributes;
      return wmsLayer;
    }

    return layer;
  };

  /**
   * Create a WindTile
   *
   * @method createWindtile
   * @static
   * @param {object} tilesource
   * @param {object} selected - OL map
   * @param {object} layer
   * @returns {object} OpenLayers WMS layer -- INCORRECT~!
   */
  const createWindtile = function(tileSource, selected, layer) {
    // Vars to generate the animation & support the mini-GUI to play with the animation settings
    let i = 0;
    let moving = false;
    let initiatedGUI = false;
    let currentFeatures;
    let zoom;
    let extent;
    let options;
    let windRender;
    const gui = new dat.GUI();

    tileSource.on('tileloadstart', (e) => {
      i += 1;
    });
    tileSource.on('tileloadend', (e) => {
      if (!windRender) {
        const mapSize = selected.getSize();
        const tileOptions = {
          olmap: selected,
          uMin: -76.57695007324219,
          uMax: 44.30181884765625,
          vMin: -76.57695007324219,
          vMax: 44.30181884765625,
          width: mapSize[0],
          height: mapSize[1],
        };
        windRender = new WindTile(tileOptions);
      }

      i -= 1;
      if (i === 1 && !windRender.stopped && windRender) {
        windRender.stop();
      }
      if (i === 0 && !moving && windRender) {
        if (!initiatedGUI) {
          setTimeout(() => { updateRenderer(); }, 1);
        } else {
          updateRendererThrottled();
        }
      }
    });

    // These listen for changes to position/zoom/other properties & re-render the animation canvas to compensate
    selected.getView().on('change:center', () => {
      if (windRender !== undefined) {
        windRender.stop();
        moving = true;
      }
    });
    selected.getView().on('propertychange', (e) => {
      if (e.key === 'resolution' && windRender) {
        windRender.stop();
        moving = true;
      }
    });

    // when the user stops moving the map, we need to re-render the windtiles in the new position
    selected.on('moveend', (e) => {
      moving = false;
      if (i === 0 && windRender) updateRendererThrottled();
    });

    const updateRenderer = () => {
      const view = selected.getView();
      const mapSize = selected.getSize();
      extent = view.calculateExtent(mapSize);
      currentFeatures = layer.getSource().getFeaturesInExtent(extent);
      zoom = view.getZoom();
      options = {
        uMin: -55.806217193603516,
        uMax: 45.42329406738281,
        vMin: -5.684286117553711,
        vMax: 44.30181884765625,
        width: mapSize[0],
        height: mapSize[1],
        ts: Date.now(),
      };
      windRender.updateData(currentFeatures, extent, zoom, options);
      if (!initiatedGUI) initGUI();
    };
    const updateRendererThrottled = throttle(updateRenderer, 150);
    const initGUI = function() {
      const { wind } = windRender;

      gui.add(wind, 'numParticles', 144, 248832).setValue(11025);
      gui.add(wind, 'fadeOpacity', 0.96, 0.999).setValue(0.996).step(0.001).updateDisplay();
      gui.add(wind, 'speedFactor', 0.05, 1.0).setValue(0.25);
      gui.add(wind, 'dropRate', 0, 0.1).setValue(0.003);
      gui.add(wind, 'dropRateBump', 0, 0.2).setValue(0.01);
      gui.add(windRender, 'dataGridWidth', 18, 360).setValue(200).step(2).onChange(updateTexture);

      initiatedGUI = true;
      updateRenderer();
    };
    const updateTexture = function() {
      windRender.updateData(currentFeatures, extent, zoom, options);
    };
  };

  /**
   * Create a new WMS Layer
   *
   * @method createLayerWMS
   * @static
   * @param {object} def - Layer Specs
   * @param {object} options - Layer options
   * @param {number} day
   * @param {object} state
   * @returns {object} OpenLayers WMS layer
   */
  const createLayerWMS = function(def, options, day, state) {
    const { proj } = state;
    const selectedProj = proj.selected;
    let urlParameters;
    let date;
    let extent;
    let start;
    let res;

    const source = config.sources[def.source];
    extent = selectedProj.maxExtent;
    start = [selectedProj.maxExtent[0], selectedProj.maxExtent[3]];
    res = selectedProj.resolutions;
    if (!source) {
      throw new Error(`${def.id}: Invalid source: ${def.source}`);
    }

    const transparent = def.format === 'image/png';
    if (selectedProj.id === 'geographic') {
      res = getGeographicResolutionWMS(def.tileSize);
    }
    if (day) {
      if (day === 1) {
        extent = LEFT_WING_EXTENT;
        start = LEFT_WING_ORIGIN;
      } else {
        extent = RIGHT_WING_EXTENT;
        start = RIGHT_WING_ORIGIN;
      }
    }
    const parameters = {
      LAYERS: def.layer || def.id,
      FORMAT: def.format,
      TRANSPARENT: transparent,
      VERSION: '1.1.1',
    };
    if (def.styles) {
      parameters.STYLES = def.styles;
    }

    urlParameters = '';

    date = options.date || getSelectedDate(state);
    if (day && def.wrapadjacentdays) {
      date = util.dateAdd(date, 'day', day);
    }
    urlParameters = `?TIME=${util.toISOStringSeconds(util.roundTimeOneMinute(date))}`;

    const sourceOptions = {
      url: source.url + urlParameters,
      cacheSize: 4096,
      wrapX: true,
      style: 'default',
      crossOrigin: 'anonymous',
      params: parameters,
      transition: 0,
      tileGrid: new OlTileGridTileGrid({
        origin: start,
        resolutions: res,
        tileSize: def.tileSize || [512, 512],
      }),
    };
    if (isPaletteActive(def.id, options.group, state)) {
      const lookup = getPaletteLookup(def.id, options.group, state);
      sourceOptions.tileClass = lookupFactory(lookup, sourceOptions);
    }
    const resolutionBreakPoint = lodashGet(def, `breakPointLayer.projections.${proj.id}.resolutionBreakPoint`);
    const tileSource = new OlSourceTileWMS(sourceOptions);

    const layer = new OlLayerTile({
      preload: 0,
      extent,
      ...!!resolutionBreakPoint && { minResolution: resolutionBreakPoint },
      source: tileSource,
    });
    layer.isWMS = true;
    return layer;
  };

  return {
    layerKey,
    createLayer,
    createLayerWMTS,
  };
}
