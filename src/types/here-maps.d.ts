// src/types/here-maps.d.ts

declare namespace H {
	namespace service {
		class Platform {
			constructor(options: { apikey: string });
			createDefaultLayers(options?: {
				tileSize?: number;
				ppi?: number;
				[key: string]: unknown;
			}): H.service.DefaultLayers;
			getRoutingService(
				version?: string,
				type?: number
			): H.service.RoutingService;
		}
	}

	class Map {
		constructor(
			element: HTMLElement,
			layer: H.service.DefaultLayers,
			options?: {
				zoom?: number;
				center?: { lat: number; lng: number };
				[key: string]: unknown;
			}
		);
		addObject(object: H.map.Object): void;
		addObjects(objects: H.map.Object[]): void;
		dispose(): void;
		getViewModel(): H.map.ViewModel;
		getViewPort(): H.map.ViewPort;
	}

	namespace map {
		class Marker extends H.map.Object {
			constructor(
				coordinates: H.geo.IPoint,
				options?: { icon?: H.map.Icon; [key: string]: unknown }
			);
		}
		class Polyline extends H.map.Object {
			constructor(
				lineString: H.geo.LineString,
				options?: { style?: H.map.SpatialStyle; [key: string]: unknown }
			);
			getBoundingBox(): H.geo.Rect;
		}
	}

	namespace geo {
		class LineString {
			static fromFlexiblePolyline(polyline: string): H.geo.LineString;
		}
	}

	namespace mapevents {
		class Behavior {
			constructor(mapEvents: H.mapevents.MapEvents);
		}
		class MapEvents {
			constructor(map: H.Map);
		}
	}

	namespace ui {
		class UI {
			static createDefault(
				map: H.Map,
				layers: H.service.DefaultLayers
			): H.ui.UI;
		}
	}
}

// Add global H namespace to window
interface Window {
	H: typeof H;
}
