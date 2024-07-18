import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useCatalogContext } from "../../context/CatalogContext";
import styles from "./MapContainer.module.css";
import { CustomProperties } from "../../types/allTypesAndInterfaces";

mapboxgl.accessToken = process.env?.REACT_APP_MAPBOX_KEY ?? "";
mapboxgl.setRTLTextPlugin(
  "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js",
  () => {}
);


const MapContainer: React.FC = () => {
  const { geoPoints, currentlySelectedLayer } = useCatalogContext();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const styleLoadedRef = useRef(false);

  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v11",
        center: [39.6074258, 24.4738121],
        attributionControl: true,
        zoom: 13,
      });

      mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");

      mapRef.current.on("styledata", () => {
        styleLoadedRef.current = true;
      });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const addGeoPoints = () => {
      if (
        mapRef.current &&
        styleLoadedRef.current &&
        geoPoints &&
        typeof geoPoints !== "string"
      ) {
        const source = mapRef.current.getSource(
          "circle"
        ) as mapboxgl.GeoJSONSource;

        if (source) {
          source.setData(geoPoints);
        } else {
          mapRef.current.addSource("circle", {
            type: "geojson",
            data: geoPoints,
            generateId: true,
          });

          mapRef.current.addLayer({
            id: "circle-layer",
            type: "circle",
            source: "circle",
            paint: {
              "circle-radius": [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                16, // Radius when hovered
                13, // Default radius
              ],
              "circle-color": ["coalesce", ["get", "color"], "#12939A"], // Default to a specific color if no color property
              "circle-opacity": 0.8,
              "circle-stroke-width": 0.4,
              "circle-stroke-color": "#898989",
            },
          });

          let hoveredStateId: number | null = null;
          let popup: mapboxgl.Popup | null = null;

          mapRef.current.on(
            "mousemove",
            "circle-layer",
            (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
              if (mapRef.current) {
                mapRef.current.getCanvas().style.cursor = "pointer";
              }
              if (e.features && e.features.length > 0) {
                if (hoveredStateId !== null) {
                  mapRef.current?.setFeatureState(
                    { source: "circle", id: hoveredStateId },
                    { hover: false }
                  );
                }
                hoveredStateId = e.features[0].id as number;
                mapRef.current?.setFeatureState(
                  { source: "circle", id: hoveredStateId },
                  { hover: true }
                );

                const coordinates = (
                  e.features[0].geometry as any
                ).coordinates.slice();
                const {
                  name,
                  address,
                  rating,
                  business_status,
                  user_ratings_total,
                } = e.features[0].properties as CustomProperties;
                const description = `
                  <div class="${styles.popupContent}">
                    <strong class="${styles.popupContentStrong}">${name}</strong>
                    <div class="${styles.popupContentDiv}">Address: ${address}</div>
                    <div class="${styles.popupContentDiv} ${styles.popupContentRating}">Rating: ${rating}</div>
                    <div class="${styles.popupContentDiv} ${styles.popupContentStatus}">Status: ${business_status}</div>
                    <div class="${styles.popupContentDiv} ${styles.popupContentTotalRatings}">Total Ratings: ${user_ratings_total}</div>
                  </div>
                `;

                if (popup) {
                  popup.remove();
                }
                popup = new mapboxgl.Popup({
                  closeButton: false,
                  className: styles.popup,
                })
                  .setLngLat(coordinates)
                  .setHTML(description)
                  .addTo(mapRef.current!);
              }
            }
          );

          mapRef.current.on("mouseleave", "circle-layer", () => {
            if (mapRef.current) {
              mapRef.current.getCanvas().style.cursor = "";
            }
            if (hoveredStateId !== null) {
              mapRef.current?.setFeatureState(
                { source: "circle", id: hoveredStateId },
                { hover: false }
              );
            }
            hoveredStateId = null;
            if (popup) {
              popup.remove();
              popup = null;
            }
          });
        }

        if (geoPoints.features && geoPoints.features.length) {
          const coordinates = geoPoints.features[geoPoints.features.length - 1]
            .geometry.coordinates as [number, number];
          mapRef.current.flyTo({
            center: coordinates,
            zoom: 13,
            speed: 10,
            curve: 1,
          });
        }
      } else {
        if (mapRef.current?.getLayer("circle-layer")) {
          mapRef.current.removeLayer("circle-layer");
        }
        if (mapRef.current?.getSource("circle")) {
          mapRef.current.removeSource("circle");
        }
      }
    };

    if (styleLoadedRef.current) {
      addGeoPoints();
    } else if (mapRef.current) {
      mapRef.current.on("styledata", addGeoPoints);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.off("styledata", addGeoPoints);
      }
    };
  }, [geoPoints, currentlySelectedLayer]);

  useEffect(() => {
    if (
      mapRef.current &&
      currentlySelectedLayer &&
      geoPoints &&
      typeof geoPoints !== "string"
    ) {
      const selectedFeature = geoPoints.features.find(
        (feature) => feature.properties.geoPointId === currentlySelectedLayer
      );
      if (selectedFeature) {
        const coordinates = selectedFeature.geometry.coordinates as [
          number,
          number
        ];
        mapRef.current.flyTo({
          center: coordinates,
          zoom: 13,
          speed: 10,
          curve: 1,
        });
      }
    }
  }, [currentlySelectedLayer, geoPoints]);

  return (
    <div
      id="map-container"
      ref={mapContainerRef}
      style={{ width: "96%", height: "100vh", zIndex: 99 }}
    />
  );
};

export default MapContainer;
