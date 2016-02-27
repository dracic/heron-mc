/*
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Function: modifyDOMElement
 *
 * Modifies many properties of a DOM element all at once.  Passing in
 * null to an individual parameter will avoid setting the attribute.
 *
 * Parameters:
 * id - {String} The element id attribute to set.
 * px - {<OpenLayers.Pixel>} The left and top style position.
 * sz - {<OpenLayers.Size>}  The width and height style attributes.
 * position - {String}       The position attribute.  eg: absolute,
 *                           relative, etc.
 * border - {String}         The style.border attribute.  eg:
 *                           solid black 2px
 * overflow - {String}       The style.overview attribute.
 * opacity - {Float}         Fractional value (0.0 - 1.0)
 */
OpenLayers.Util.modifyDOMElement = function (element, id, px, sz, position,
                                             border, overflow, opacity) {

    if (id) {
        element.id = id;
    }
    if (px) {
        if (!px.x) {
            // JvdB: fix for IE who cannot deal with NaN
            px.x = 0;
        }
        if (!px.y) {
            // JvdB: fix for IE who cannot deal with NaN
            px.y = 0;
        }
        element.style.left = px.x + "px";
        element.style.top = px.y + "px";
    }
    if (sz) {
        element.style.width = sz.w + "px";
        element.style.height = sz.h + "px";
    }
    if (position) {
        element.style.position = position;
    }
    if (border) {
        element.style.border = border;
    }
    if (overflow) {
        element.style.overflow = overflow;
    }
    if (parseFloat(opacity) >= 0.0 && parseFloat(opacity) < 1.0) {
        element.style.filter = 'alpha(opacity=' + (opacity * 100) + ')';
        element.style.opacity = opacity;
    } else if (parseFloat(opacity) == 1.0) {
        element.style.filter = '';
        element.style.opacity = '';
    }
};

// 18.2.14 Solve issues with PrintPreview not cloning all properties for Vector features
// in particular not showing OLE text labels with renderIntent defaultLabel.
// https://github.com/heron-mc/heron-mc/issues/331
/**
 * Method: clone
 * Create a clone of this vector feature.  Does not set any non-standard
 *     properties.
 *
 * Returns:
 * {<OpenLayers.Feature.Vector>} An exact clone of this vector feature.
 */
OpenLayers.Feature.Vector.prototype.clone = function () {
    var clone = new OpenLayers.Feature.Vector(
        this.geometry ? this.geometry.clone() : null,
        this.attributes,
        this.style);

    // JvdB : must clone layer? but later
    // clone.layer = this.layer;
    clone.renderIntent = this.renderIntent;
    return clone;
};

/**
 * Method: clone
 * Create a clone of this layer.
 *
 * Note: Features of the layer are also cloned.
 *
 * Returns:
 * {<OpenLayers.Layer.Vector>} An exact clone of this layer
 */
OpenLayers.Layer.Vector.prototype.clone = function (obj) {

    if (obj == null) {
        obj = new OpenLayers.Layer.Vector(this.name, this.getOptions());
    }

    //get all additions from superclasses
    obj = OpenLayers.Layer.prototype.clone.apply(this, [obj]);

    // Allow for custom layer behavior
    // JvdB: also clone strategies as they have a layer attribute which should be the new layer obj!!
    if (this.strategies) {
        obj.strategies = [];
        for (var i = 0, len = this.strategies.length; i < len; i++) {
            obj.strategies.push(Heron.Utils.createOLObject([this.strategies[i].CLASS_NAME, this.strategies[i]]));
            obj.strategies[i].setLayer(obj);
        }
    }

    // copy/set any non-init, non-simple values here
    var features = this.features;
    var len = features.length;
    var clonedFeatures = new Array(len);
    for (var i = 0; i < len; ++i) {
        clonedFeatures[i] = features[i].clone();

        // JvdB: also copy optional layer attribute
        if (features[i].layer) {
            clonedFeatures[i].layer = obj;
        }
    }
    obj.features = clonedFeatures;

    // JvdB: If a Layer has a StyleMap it is not always cloned properly
    if (this.styleMap && this.styleMap.styles) {
        var clonedStyles = {};
        for (var key in this.styleMap.styles) {
            clonedStyles[key] = this.styleMap.styles[key].clone();
        }
        obj.styleMap = new OpenLayers.StyleMap(clonedStyles);
    }

    return obj;
};

/**
 * APIMethod: clone
 * Clones this rule.
 *
 * Returns:
 * {<OpenLayers.Rule>} Clone of this rule.
 */
OpenLayers.Rule.prototype.clone = function () {
    var options = OpenLayers.Util.extend({}, this);
    if (this.symbolizers) {
        // clone symbolizers
        var len = this.symbolizers.length;
        options.symbolizers = new Array(len);
        for (var i = 0; i < len; ++i) {
            options.symbolizers[i] = this.symbolizers[i].clone();
        }
    } else {
        // clone symbolizer
        options.symbolizer = {};
        var value, type;
        for (var key in this.symbolizer) {
            value = this.symbolizer[key];
            type = typeof value;
            if (type === "object") {
                options.symbolizer[key] = OpenLayers.Util.extend({}, value);
                // JvdB: must clone other fields like booleans and reals
                // } else if(type === "string") {
            } else {
                options.symbolizer[key] = value;
            }
        }
    }
    // clone filter
    options.filter = this.filter && this.filter.clone();
    // clone context
    options.context = this.context && OpenLayers.Util.extend({}, this.context);
    return new OpenLayers.Rule(options);
};

// Solve issues with feature selection for features that have individual styles.
/**
 * Method: highlight
 * Redraw feature with the select style.
 *
 * Parameters:
 * feature - {<OpenLayers.Feature.Vector>}
 */
OpenLayers.Control.SelectFeature.prototype.highlight = function (feature) {
    var layer = feature.layer;
    var cont = this.events.triggerEvent("beforefeaturehighlighted", {
        feature: feature
    });
    if (cont !== false) {
        feature._prevHighlighter = feature._lastHighlighter;
        feature._lastHighlighter = this.id;

        // Solve issues with feature selection for features that have individual styles.
        // Use the Layer select style in that case
        if (feature.style && !this.selectStyle && layer.styleMap) {
            var styleMap = layer.styleMap;
            var selectStyle = styleMap.styles['select'];
            if (selectStyle) {
                var defaultStyle = styleMap.styles['default'].clone();
                this.selectStyle = OpenLayers.Util.extend(defaultStyle.defaultStyle, selectStyle.defaultStyle);
            }
        }
        var style = this.selectStyle || this.renderIntent;

        layer.drawFeature(feature, style);
        this.events.triggerEvent("featurehighlighted", {feature: feature});
    }
};


//
// 13.2.2014 - CHANGES for WMSGetFeatureInfo
//
// Version from GitHub (OL 2.12+2.13 are same for these funcs)
// * change: new config param 'requestPerLayer': do not bundle requests for same URL
// * change: allow per-layer vendor params
// Changes indicated on lines with 'JvdB'.
// Changes were required to allow  GFI for WMS "sublayers" based on CQL (or other query lang).
// See example: http://lib.heron-mc.org/heron/latest/examples/sublayers
//
/* Copyright (c) 2006-2012 by OpenLayers Contributors (see authors.txt for
 * full list of contributors). Published under the 2-clause BSD license.
 * See license.txt in the OpenLayers distribution or repository for the
 * full text of the license. */



/**
 * Class: OpenLayers.Control.WMSGetFeatureInfo
 * The WMSGetFeatureInfo control uses a WMS query to get information about a point on the map.  The
 * information may be in a display-friendly format such as HTML, or a machine-friendly format such
 * as GML, depending on the server's capabilities and the client's configuration.  This control
 * handles click or hover events, attempts to parse the results using an OpenLayers.Format, and
 * fires a 'getfeatureinfo' event with the click position, the raw body of the response, and an
 * array of features if it successfully read the response.
 *
 * Inherits from:
 *  - <OpenLayers.Control>
 */

/**
 * Method: buildWMSOptions
 * Build an object with the relevant WMS options for the GetFeatureInfo request
 *
 * Parameters:
 * url - {String} The url to be used for sending the request
 * layers - {Array(<OpenLayers.Layer.WMS)} An array of layers
 * clickPosition - {<OpenLayers.Pixel>} The position on the map where the mouse
 *     event occurred.
 * format - {String} The format from the corresponding GetMap request
 */
OpenLayers.Control.WMSGetFeatureInfo.prototype.buildWMSOptions = function (url, layers, clickPosition, format) {
    var layerNames = [], styleNames = [];
    var time;
    for (var i = 0, len = layers.length; i < len; i++) {
        if (layers[i].params.LAYERS != null) {
            layerNames = layerNames.concat(layers[i].params.LAYERS);
            styleNames = styleNames.concat(this.getStyleNames(layers[i]));
        }
        if (layers[i].params.TIME != null) {
            this.vendorParams.time = layers[i].params.TIME;
        }
    }
    var firstLayer = layers[0];
    // use the firstLayer's projection if it matches the map projection -
    // this assumes that all layers will be available in this projection
    var projection = this.map.getProjection();
    var layerProj = firstLayer.projection;
    if (layerProj && layerProj.equals(this.map.getProjectionObject())) {
        projection = layerProj.getCode();
    }
    var params = OpenLayers.Util.extend({
            service: "WMS",
            version: firstLayer.params.VERSION,
            request: "GetFeatureInfo",
            exceptions: firstLayer.params.EXCEPTIONS,
            bbox: this.map.getExtent().toBBOX(null,
                firstLayer.reverseAxisOrder()),
            feature_count: this.maxFeatures,
            height: this.map.getSize().h,
            width: this.map.getSize().w,
            format: format,
            info_format: firstLayer.params.INFO_FORMAT || this.infoFormat
        }, (parseFloat(firstLayer.params.VERSION) >= 1.3) ?
        {
            crs: projection,
            i: parseInt(clickPosition.x),
            j: parseInt(clickPosition.y)
        } :
        {
            srs: projection,
            x: parseInt(clickPosition.x),
            y: parseInt(clickPosition.y)
        }
    );
    if (layerNames.length != 0) {
        params = OpenLayers.Util.extend({
            layers: layerNames,
            query_layers: layerNames,
            styles: styleNames
        }, params);
    }

    // JvdB : Apply per-layer vendor params like CQL if present
    OpenLayers.Util.applyDefaults(params, firstLayer.params.vendorParams);

    OpenLayers.Util.applyDefaults(params, this.vendorParams);
    return {
        url: url,
        params: OpenLayers.Util.upperCaseObject(params),
        callback: function (request) {
            this.handleResponse(clickPosition, request, url);
        },
        scope: this
    };
};

/**
 * Method: request
 * Sends a GetFeatureInfo request to the WMS
 *
 * Parameters:
 * clickPosition - {<OpenLayers.Pixel>} The position on the map where the
 *     mouse event occurred.
 * options - {Object} additional options for this method.
 *
 * Valid options:
 * - *hover* {Boolean} true if we do the request for the hover handler
 */
OpenLayers.Control.WMSGetFeatureInfo.prototype.request = function (clickPosition, options) {
    var layers = this.findLayers();
    if (layers.length == 0) {
        this.events.triggerEvent("nogetfeatureinfo");
        // Reset the cursor.
        OpenLayers.Element.removeClass(this.map.viewPortDiv, "olCursorWait");
        return;
    }

    options = options || {};
    if (this.drillDown === false) {
        var wmsOptions = this.buildWMSOptions(this.url, layers,
            clickPosition, layers[0].params.FORMAT);
        var request = OpenLayers.Request.GET(wmsOptions);

        if (options.hover === true) {
            this.hoverRequest = request;
        }
    } else {
        this._requestCount = 0;
        this._numRequests = 0;
        this.features = [];
        // group according to service url to combine requests
        var services = {}, url;
        for (var i = 0, len = layers.length; i < len; i++) {
            var layer = layers[i];
            var service, found = false;
            url = OpenLayers.Util.isArray(layer.url) ? layer.url[0] : layer.url;
            if (url in services) {
                services[url].push(layer);
            } else {
                this._numRequests++;
                services[url] = [layer];
            }
        }
        var layers;
        for (var url in services) {
            layers = services[url];
            // JvdB: in some sames the client does not want to bundle requests
            // for multiple Layers from same server, e.g. with CQL-based requests
            // the responses need to be tied to the CQL sublayer.
            if (this.requestPerLayer) {
                for (var l = 0, len = layers.length; l < len; l++) {
                    var wmsOptions = this.buildWMSOptions(url, [layers[l]],
                        clickPosition, layers[0].params.FORMAT);
                    var req = OpenLayers.Request.GET(wmsOptions);

                    // Tie the Layer to the request as we can determine
                    // to which Layer a response belongs
                    req.layer = layers[l];
                }
                // Increment request-count as we had 1 req per url above
                this._numRequests += layers.length - 1;
            } else {
                var wmsOptions = this.buildWMSOptions(url, layers,
                    clickPosition, layers[0].params.FORMAT);
                OpenLayers.Request.GET(wmsOptions);
            }
        }
    }
};


/**
 * Method: handleResponse
 * Handler for the GetFeatureInfo response.
 *
 * Parameters:
 * xy - {<OpenLayers.Pixel>} The position on the map where the
 *     mouse event occurred.
 * request - {XMLHttpRequest} The request object.
 * url - {String} The url which was used for this request.
 */
OpenLayers.Control.WMSGetFeatureInfo.prototype.handleResponse = function (xy, request, url) {

    var doc = request.responseXML;
    if (!doc || !doc.documentElement) {
        doc = request.responseText;
    }
    var features = this.format.read(doc);

    // JvdB remember the Layer e.g. to discern Layer subsets (via CQL)
    if (request.layer && features) {
        for (var f = 0; f < features.length; f++) {
            features[f].layer = request.layer;
        }
    }
    if (this.drillDown === false) {
        this.triggerGetFeatureInfo(request, xy, features);
    } else {
        this._requestCount++;
        if (this.output === "object") {
            this._features = (this._features || []).concat(
                {url: url, features: features}
            );
        } else {
            this._features = (this._features || []).concat(features);
        }
        if (this._requestCount === this._numRequests) {
            this.triggerGetFeatureInfo(request, xy, this._features.concat());
            delete this._features;
            delete this._requestCount;
            delete this._numRequests;
        }
    }
};


// Added 11.8.2014 - JvdB
// Solve Capabilities parsing issues in IE: XML DOM uses  validation by default, i.e.
// fetching DTDs. In many cases the validation fails (even if the document is vald it seems).
// https://github.com/heron-mc/heron-mc/issues/324
// Also not fixed in OL 2.13!
// See https://github.com/openlayers/openlayers/issues/1379
// We need the same implementation as OL XMLHttpRequest.js
//            oDocument    = new window.ActiveXObject("Microsoft.XMLDOM");
//            oDocument.async                = false;
//            oDocument.validateOnParse    = false;
//            oDocument.loadXML(sResponse);

/**
 * APIMethod: read
 * Deserialize a XML string and return a DOM node.
 *
 * Parameters:
 * text - {String} A XML string

 * Returns:
 * {DOMElement} A DOM node
 */
OpenLayers.Format.XML.prototype.read = function (text) {

    var index = text.indexOf('<');
    if (index > 0) {
        text = text.substring(index);
    }
    var node = OpenLayers.Util.Try(
        OpenLayers.Function.bind((
            function () {
                var xmldom;
                /**
                 * Since we want to be able to call this method on the prototype
                 * itself, this.xmldom may not exist even if in IE.
                 */
                if (window.ActiveXObject && !this.xmldom) {
                    xmldom = new ActiveXObject("Microsoft.XMLDOM");
                } else {
                    xmldom = this.xmldom;

                }
                xmldom.validateOnParse = false;
                xmldom.loadXML(text);
                return xmldom;
            }
        ), this),
        function () {
            return new DOMParser().parseFromString(text, 'text/xml');
        },
        function () {
            var req = new XMLHttpRequest();
            req.open("GET", "data:" + "text/xml" +
            ";charset=utf-8," + encodeURIComponent(text), false);
            if (req.overrideMimeType) {
                req.overrideMimeType("text/xml");
            }
            req.send(null);
            return req.responseXML;
        }
    );

    if (this.keepData) {
        this.data = node;
    }

    return node;
};