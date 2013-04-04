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
Ext.namespace("Heron.widgets");

/** api: (define)
 *  module = Heron.widgets
 *  class = FeatSelGridPanel
 *  base_link = `GeoExt.form.FormPanel <http://www.geoext.org/lib/GeoExt/widgets/form/FormPanel.html>`_
 */

/** api: example
 *  Sample code showing how to configure a Heron FeatSelGridPanel. In this case
 *  a popup ExtJS Window is created with a single FeatSelGridPanel (xtype: 'hr_featselgridpanel').
 *
 *  .. code-block:: javascript

 Ext.onReady(function() {
	 // create a panel and add the map panel and grid panel
	 // inside it
	 new Ext.Window({
	 title: __('Click Map or Grid to Select - Double Click to Zoom to feature'),
	 layout: "fit",
	 x: 50,
	 y: 100,
	 height: 400,
	 width: 280,
	 items: [
	 {
	 xtype: 'hr_featselgridpanel',
	 id: 'hr-featselgridpanel',
	 title: __('Parcels'),
	 header: false,
	 columns: [
	 {
	 header: "Fid",
	 width: 60,
	 dataIndex: "id",
	 type: 'string'
	 },
	 {
	 header: "ObjectNum",
	 width: 180,
	 dataIndex: "objectnumm",
	 type: 'string'
	 }
	 ],
	 hropts: {
	 storeOpts:  {
	 proxy: new GeoExt.data.ProtocolProxy({
	 protocol: new OpenLayers.Protocol.HTTP({
	 url: 'data/parcels.json',
	 format: new OpenLayers.Format.GeoJSON()
	 })
	 }),
	 autoLoad: true
	 },
	 zoomOnRowDoubleClick : true,
	 zoomOnFeatureSelect : false,
	 zoomLevelPointSelect : 8,
	 separateSelectionLayer: true
	 }
	 }
	 ]
	 }).show();
	 });

 *
 */


/** api: constructor
 *  .. class:: FeatSelGridPanel(config)
 *
 *  Show features both in a grid and on the map and have them selectable.
 */
Heron.widgets.FeatSelGridPanel = Ext.extend(Ext.grid.GridPanel, {
	/** api: config[separateSelectionLayer]
	 *  ``Boolean``
	 *  Should selected features be managed in separate overlay Layer (handy for printing) ?.
	 */
	separateSelectionLayer: false,

	/** api: config[zoomOnFeatureSelect]
	 *  ``Boolean``
	 *  Zoom to feature (extent) when selected ?.
	 */
	zoomOnFeatureSelect: false,

	/** api: config[zoomOnRowDoubleClick]
	 *  ``Boolean``
	 *  Zoom to feature (extent) when row is double clicked ?.
	 */
	zoomOnRowDoubleClick: true,

	/** api: config[zoomLevelPointSelect]
	 *  ``Integer``
	 *  Zoom level for point features when selected, default ``10``.
	 */
	zoomLevelPointSelect: 10,

	/** api: config[zoomLevelPoint]
	 *  ``Integer``
	 *  Zoom level when layer is single point feature, default ``10``.
	 */
	zoomLevelPoint: 10,

	/** api: config[zoomToDataExtent]
	 *  ``Boolean``
	 *  Zoom to layer data extent when loaded ?.
	 */
	zoomToDataExtent: false,

	/** api: config[autoConfig]
	 *  ``Boolean``
	 *  Should the store and grid columns autoconfigure from loaded features?.
	 */
	autoConfig: true,

	initComponent: function () {
		// If columns specified we don't do autoconfig (column guessing from features)
		if (this.columns) {
			this.autoConfig = false;
		}

		// Define OL Vector Layer to display search result features
		var layer = this.layer = new OpenLayers.Layer.Vector(this.title);

		this.map = Heron.App.getMap();
		this.map.addLayer(this.layer);

		// Heron-specific config (besides GridPanel config)
		Ext.apply(this, this.hropts);

		var self = this;
		if (this.zoomOnFeatureSelect) {
			// See http://www.geoext.org/pipermail/users/2011-March/002052.html
			layer.events.on({
				"featureselected": function (e) {
					self.zoomToFeature(self, e.feature.geometry);
				},
				"dblclick": function (e) {
					self.zoomToFeature(self, e.feature.geometry);
				},
				"scope": layer
			});
		}

		this.setupStore(this.features);

		// Enables the interaction between features on the Map and Grid
		if (!this.sm) {
			this.sm = new GeoExt.grid.FeatureSelectionModel();
		}

		// May zoom to feature when grid row is double-clicked.
		if (this.zoomOnRowDoubleClick) {
			this.on('celldblclick', function (grid, rowIndex, columnIndex, e) {
				var record = grid.getStore().getAt(rowIndex);
				var feature = record.getFeature();
				self.zoomToFeature(self, feature.geometry);
			});
		}

		// Manage map and grid state on visibility change.
		if (this.ownerCt) {
			// Save ref to ourselves
			this.ownerCt.on('hide', function () {
				self.hideLayer();
			});
		}

		if (this.separateSelectionLayer) {
			this.selLayer = new OpenLayers.Layer.Vector(this.title + '_Sel');
			// selLayer.style = layer.styleMap.styles['select'].clone();
			this.selLayer.styleMap.styles['default'] = layer.styleMap.styles['select'];
			this.selLayer.style = this.selLayer.styleMap.styles['default'].defaultStyle;
			// this.selLayer.style = layer.styleMap.styles['select'].clone();
			layer.styleMap.styles['select'] = layer.styleMap.styles['default'].clone();
			layer.styleMap.styles['select'].defaultStyle.fillColor = 'white';
			layer.styleMap.styles['select'].defaultStyle.fillOpacity = 0.0;
			this.map.addLayer(this.selLayer);
			this.map.setLayerIndex(this.selLayer, this.map.layers.length - 1);
			layer.events.on({
				featureselected: this.updateSelectionLayer,
				featureunselected: this.updateSelectionLayer,
				scope: this
			});
		}

		Heron.widgets.FeatSelGridPanel.superclass.initComponent.call(this);
	},

	/** api: method[loadFeatures]
	 * Loads array of feature objects in store and shows them on grid and map.
	 */
	loadFeatures: function (features) {
		this.removeFeatures();

		// Defensive programming
		if (!features || features.length == 0) {
			return;
		}

		this.showLayer();
		this.store.loadData(features);

		if (this.zoomToDataExtent) {
			if (features.length == 1 && features[0].geometry.CLASS_NAME == "OpenLayers.Geometry.Point") {
				var point = features[0].geometry.getCentroid();
				this.map.setCenter(new OpenLayers.LonLat(point.x, point.y), this.zoomLevelPoint);
			} else {
				this.map.zoomToExtent(this.layer.getDataExtent());
			}
		}
	},

	/** api: method[removeFeatures]
	 * Removes all feature objects from store .
	 */
	removeFeatures: function () {
		this.store.removeAll(false);
		if (this.selLayer) {
			this.selLayer.removeAllFeatures({silent: true});
		}
	},


	/** api: method[showLayer]
	 * Show the layer with features on the map.
	 */
	showLayer: function () {
		// this.removeFeatures();
		if (this.layer) {
			if (this.selLayer) {
				this.map.setLayerIndex(this.selLayer, this.map.layers.length - 1);
				this.map.setLayerIndex(this.layer, this.map.layers.length - 2);
			} else {
				this.map.setLayerIndex(this.layer, this.map.layers.length - 1);
			}
			if (!this.layer.getVisibility()) {
				this.layer.setVisibility(true);
			}
			if (this.selLayer && !this.selLayer.getVisibility()) {
				this.selLayer.setVisibility(true);
			}
		}
	},

	/** api: method[hideLayer]
	 * Hide the layer with features on the map.
	 */
	hideLayer: function () {
		// this.removeFeatures();
		if (this.layer && this.layer.getVisibility()) {
			this.layer.setVisibility(false);
		}
		if (this.selLayer && this.selLayer.getVisibility()) {
			this.selLayer.setVisibility(false);
		}
	},

	/** api: method[hideLayer]
	 * Hide the layer with features on the map.
	 */
	zoomToFeature: function (self, geometry) {
		if (!geometry) {
			return;
		}

		// For point features center map otherwise zoom to geometry bounds
		if (geometry.getVertices().length == 1) {
			var point = geometry.getCentroid();
			self.map.setCenter(new OpenLayers.LonLat(point.x, point.y), self.zoomLevelPointSelect);
		} else {
			self.map.zoomToExtent(geometry.getBounds());
		}
	},

	zoomButtonRenderer: function () {
		var id = Ext.id();

		(function () {
			new Ext.Button({
				renderTo: id,
				text: 'Zoom'
			});

		}).defer(25);

		return (String.format('<div id="{0}"></div>', id));
	},

	/** private: method[setupStore]
	 *  :param features: ``Array`` optional features.
	 */
	setupStore: function (features) {
		if (this.store && !this.autoConfig) {
			return;
		}

		// Prepare fields array for store from columns in Grid config.
		var storeFields = [];
		if (this.autoConfig && features) {
			this.columns = [];
			for (var i = 0; i < features.length; i++) {
				var feature = features[i];
				var fieldName;
				for (fieldName in feature.attributes) {
						//
						var column = {
							header: fieldName,
							width: 100,
							dataIndex: fieldName,
							sortable: true
						};
						this.columns.push(column);
						storeFields.push({name: column.dataIndex});
				}
				break;
			}
		} else {
			Ext.each(this.columns, function (column) {
				if (column.dataIndex) {
					storeFields.push({name: column.dataIndex, type: column.type});
				}
				column.sortable = true;
			});
		}

		// this.columns.push({ header: 'Zoom', width: 60, sortable: false, renderer: self.zoomButtonRenderer });

		// Define the Store
		var storeConfig = { layer: this.layer, fields: storeFields};

		// Optional extra store options in config
		Ext.apply(storeConfig, this.hropts.storeOpts);

		this.store = new GeoExt.data.FeatureStore(storeConfig);
	},

	/** private: method[updateSelectionLayer]
	 *  :param evt: ``Object`` An object with a feature property referencing
	 *                         the selected or unselected feature.
	 */
	updateSelectionLayer: function (evt) {
		this.selLayer.removeAllFeatures({silent: true});
		var features = this.layer.selectedFeatures;
		for (var i = 0; i < features.length; i++) {
			var feature = features[i].clone();
			this.selLayer.addFeatures(feature);
		}
	},

	/** private: method[cleanup]
	 * Cleanup usually before our panel is destroyed.
	 */
	cleanup : function() {
		this.removeFeatures();
		this.map.removeLayer(this.layer);
		if (this.selLayer) {
			this.map.removeLayer(this.selLayer);
		}
	}

});

/** api: xtype = hr_featselgridpanel */
Ext.reg('hr_featselgridpanel', Heron.widgets.FeatSelGridPanel);

