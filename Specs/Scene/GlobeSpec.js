defineSuite([
        'Scene/Globe',
        'Core/CesiumTerrainProvider',
        'Core/loadWithXhr',
        'Core/Rectangle',
        'Scene/SingleTileImageryProvider',
        'Specs/createScene',
        'Specs/pollToPromise'
    ], function(
        Globe,
        CesiumTerrainProvider,
        loadWithXhr,
        Rectangle,
        SingleTileImageryProvider,
        createScene,
        pollToPromise) {
    'use strict';

    var scene;
    var globe;

    beforeAll(function() {
        scene = createScene();
    });

    afterAll(function() {
        scene.destroyForSpecs();
    });

    beforeEach(function() {
        globe = new Globe();
        scene.globe = globe;
    });

    afterEach(function() {
        scene.globe = undefined;
        loadWithXhr.load = loadWithXhr.defaultLoad;
    });

    function returnTileJson(path) {
        var oldLoad = loadWithXhr.load;
        loadWithXhr.load = function(url, responseType, method, data, headers, deferred, overrideMimeType) {
            if (url.indexOf('layer.json') >= 0) {
                loadWithXhr.defaultLoad(path, responseType, method, data, headers, deferred);
            } else {
                return oldLoad(url, responseType, method, data, headers, deferred, overrideMimeType);
            }
        };
    }

    function returnVertexNormalTileJson() {
        return returnTileJson('Data/CesiumTerrainTileJson/VertexNormals.tile.json');
    }

    /**
     * Repeatedly calls render until the load queue is empty. Returns a promise that resolves
     * when the load queue is empty.
     */
    function updateUntilDone(globe) {
        // update until the load queue is empty.
        return pollToPromise(function() {
            globe._surface._debug.enableDebugOutput = true;
            scene.render();
            return globe._surface.tileProvider.ready && globe._surface._tileLoadQueueHigh.length === 0 && globe._surface._tileLoadQueueMedium.length === 0 && globe._surface._tileLoadQueueLow.length === 0 && globe._surface._debug.tilesWaitingForChildren === 0;
        });
    }

    it('renders with enableLighting', function() {
        globe.enableLighting = true;

        var layerCollection = globe.imageryLayers;
        layerCollection.removeAll();
        layerCollection.addImageryProvider(new SingleTileImageryProvider({url : 'Data/Images/Red16x16.png'}));

        scene.camera.setView({ destination : new Rectangle(0.0001, 0.0001, 0.0025, 0.0025) });

        return updateUntilDone(globe).then(function() {
            scene.globe.show = false;
            expect(scene).toRender([0, 0, 0, 255]);
            scene.globe.show = true;
            expect(scene).notToRender([0, 0, 0, 255]);
        });
    });

    it('renders with showWaterEffect set to false', function() {
        globe.showWaterEffect = false;

        var layerCollection = globe.imageryLayers;
        layerCollection.removeAll();
        layerCollection.addImageryProvider(new SingleTileImageryProvider({url : 'Data/Images/Red16x16.png'}));

        scene.camera.setView({ destination : new Rectangle(0.0001, 0.0001, 0.0025, 0.0025) });

        return updateUntilDone(globe).then(function() {
            scene.globe.show = false;
            expect(scene).toRender([0, 0, 0, 255]);
            scene.globe.show = true;
            expect(scene).notToRender([0, 0, 0, 255]);
        });
    });

    it('ImageryLayersUpdated event fires when layer is added, hidden, shown, moved, or removed', function() {
        var timesEventRaised = 0;
        globe.imageryLayersUpdatedEvent.addEventListener(function () {
            ++timesEventRaised;
        });

        var layerCollection = globe.imageryLayers;
        layerCollection.removeAll();
        var layer = layerCollection.addImageryProvider(new SingleTileImageryProvider({url : 'Data/Images/Red16x16.png'}));
        layerCollection.addImageryProvider(new SingleTileImageryProvider({url : 'Data/Images/Red16x16.png'}));
        return updateUntilDone(globe).then(function() {
            expect(timesEventRaised).toEqual(2);

            layer.show = false;
            return updateUntilDone(globe);
        }).then(function () {
            expect(timesEventRaised).toEqual(3);

            layer.show = true;
            return updateUntilDone(globe);
        }).then(function () {
            expect(timesEventRaised).toEqual(4);

            layerCollection.raise(layer);
            return updateUntilDone(globe);
        }).then(function () {
            expect(timesEventRaised).toEqual(5);

            layerCollection.remove(layer);
            return updateUntilDone(globe);
        }).then(function () {
            expect(timesEventRaised).toEqual(6);
        });
    });

    it('terrainProviderChanged event fires', function() {
        var terrainProvider = new CesiumTerrainProvider({
            url : 'made/up/url',
            requestVertexNormals : true
        });

        var spyListener = jasmine.createSpy('listener');
        globe.terrainProviderChanged.addEventListener(spyListener);

        globe.terrainProvider = terrainProvider;

        expect(spyListener).toHaveBeenCalledWith(terrainProvider);
    });

    it('renders terrain with enableLighting', function() {
        globe.enableLighting = true;

        var layerCollection = globe.imageryLayers;
        layerCollection.removeAll();
        layerCollection.addImageryProvider(new SingleTileImageryProvider({url : 'Data/Images/Red16x16.png'}));

        loadWithXhr.load = function(url, responseType, method, data, headers, deferred, overrideMimeType) {
            loadWithXhr.defaultLoad('Data/CesiumTerrainTileJson/tile.vertexnormals.terrain', responseType, method, data, headers, deferred);
        };

        returnVertexNormalTileJson();

        var terrainProvider = new CesiumTerrainProvider({
            url : 'made/up/url',
            requestVertexNormals : true
        });

        globe.terrainProvider = terrainProvider;

        return pollToPromise(function() {
            return terrainProvider.ready;
        }).then(function() {
            scene.camera.setView({ destination : new Rectangle(0.0001, 0.0001, 0.0025, 0.0025) });

            return updateUntilDone(globe).then(function() {
                scene.globe.show = false;
                expect(scene).toRender([0, 0, 0, 255]);
                scene.globe.show = true;
                expect(scene).notToRender([0, 0, 0, 255]);
            });
        });
    });
}, 'WebGL');
