# Marco - Maps Engineer Memory

- 2026-03-18: Full Maps Integration Milestone completed:
    - Implemented **Polyline Persistence** in `rides` table to save API costs and speed up map rendering.
    - Implemented **Places Session Tokens** in `PlacesAutocomplete` for massive cost reduction in address searches.
    - Added **PlacesAutocomplete** to `PatientForm` for automated address capture.
    - Enhanced **Driver Navigation**: Links now use high-precision coordinates (`lat,lng`) instead of text addresses.
    - Added **Dynamic Navigation Buttons**: Driver list now shows "Abholung ansteuern" or "Ziel ansteuern" based on ride status.
    - Implemented **ETA Display** on Ride Detail page (`pickup_time + duration`).
    - Updated **RouteMap** to visually render the polyline route path.
    - Standardized API key naming in `.env.local.example`.
