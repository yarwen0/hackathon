# Mississippi Health Equity Gap Index — Schema (ER Diagram)

**9 tables · 82 counties · 5 data sources · Generated 2026-05-16**

This file is the source of truth for the ER diagram. The rendered image at
`schema/er_diagram.png` is regenerated from this file's mermaid block by the
loader (or can be re-rendered manually via `https://mermaid.live` or any
mermaid-compatible viewer).

## Diagram

```mermaid
---
title: Mississippi Health Equity Gap Index — Schema
---
erDiagram
    counties              ||--o{ health_indicators       : "has many"
    counties              ||--|| social_vulnerability    : "has one"
    counties              ||--o{ providers               : "located in"
    counties              ||--o{ provider_capacity       : "aggregated by"
    counties              ||--o{ zcta_county_crosswalk   : "touched by"
    measures              ||--o{ health_indicators       : "described by"
    taxonomies            ||--o{ providers               : "categorizes"
    taxonomies            ||--o{ provider_capacity       : "categorizes"

    counties {
        TEXT     fips                          PK
        TEXT     county_name
        TEXT     state_fips
        TEXT     state_abbr
        INTEGER  population
        TEXT     region
        INTEGER  is_delta
        INTEGER  is_rural
        REAL     latitude
        REAL     longitude
    }

    data_sources {
        TEXT     source_id                     PK
        TEXT     dataset_name
        TEXT     publisher
        TEXT     vintage
        TEXT     release_date
        TEXT     retrieval_date
        TEXT     source_url
        TEXT     local_path
        INTEGER  rows_loaded
        TEXT     notes
    }

    measures {
        TEXT     measure_id                    PK
        TEXT     measure_short
        TEXT     measure_full
        TEXT     category
        TEXT     category_id
        TEXT     data_value_unit
        INTEGER  is_in_burden_composite
        INTEGER  polarity
        TEXT     notes
    }

    taxonomies {
        TEXT     taxonomy_code                 PK
        TEXT     taxonomy_label
        INTEGER  is_primary_care
    }

    zcta_county_crosswalk {
        TEXT     zcta5                         PK
        TEXT     fips                          PK_FK
        TEXT     county_name
        INTEGER  arealand_zcta
        INTEGER  arealand_part
        INTEGER  is_assigned
    }

    health_indicators {
        TEXT     fips                          PK_FK
        TEXT     measure_id                    PK_FK
        INTEGER  year                          PK
        TEXT     data_value_type               PK
        REAL     data_value
        REAL     low_ci
        REAL     high_ci
        INTEGER  total_population
    }

    social_vulnerability {
        TEXT     fips                          PK_FK
        INTEGER  svi_year
        REAL     rpl_themes
        REAL     rpl_theme1_socioeconomic
        REAL     rpl_theme2_household
        REAL     rpl_theme3_minority
        REAL     rpl_theme4_housing_transport
        INTEGER  e_totpop
        REAL     ep_pov150
        REAL     ep_unemp
        REAL     ep_uninsur
        REAL     ep_age65
        REAL     ep_age17
        REAL     ep_disabl
        REAL     ep_sngpnt
        REAL     ep_limeng
        REAL     ep_minrty
        REAL     ep_mobile
        REAL     ep_crowd
        REAL     ep_noveh
        REAL     ep_groupq
    }

    providers {
        TEXT     npi                           PK
        TEXT     entity_type_code
        TEXT     last_name
        TEXT     first_name
        TEXT     practice_city
        TEXT     practice_state
        TEXT     practice_zip5
        TEXT     practice_zip_full
        TEXT     fips                          FK
        TEXT     taxonomy_code                 FK
        TEXT     enumeration_date
        INTEGER  is_active
    }

    provider_capacity {
        TEXT     fips                          PK_FK
        TEXT     taxonomy_code                 PK_FK
        INTEGER  provider_count
    }
```

## Relationship reference

| From → To | Cardinality | Why |
|---|---|---|
| `counties` → `health_indicators` | 1 — many | one county has many measure-year-value-type rows (~80 per county) |
| `counties` → `social_vulnerability` | 1 — 1 | exactly one SVI row per MS county |
| `counties` → `providers` | 1 — many | one county has many providers; `providers.fips` is nullable for unmatched ZIPs (D-010) |
| `counties` → `provider_capacity` | 1 — many | 6 taxonomy rows per county (zero counts seeded) |
| `counties` → `zcta_county_crosswalk` | 1 — many | many ZCTA-county intersection rows per county |
| `measures` → `health_indicators` | 1 — many | each of 40 measures appears in ~164 fact rows |
| `taxonomies` → `providers` | 1 — many | one taxonomy classifies many providers |
| `taxonomies` → `provider_capacity` | 1 — many | one taxonomy appears in 82 county-capacity rows |

`data_sources` is intentionally an island — it carries provenance metadata
about the load process itself and has no FK ties to the analytical tables.

## Visual conventions in the diagram

- `PK` — primary key (single-column)
- `PK_FK` — primary-key column that is also a foreign key
- `FK` — foreign-key column not part of the PK
- `||--o{` — one-to-many
- `||--||` — one-to-one
- Tables without inbound relationships (`data_sources`) sit independently.

`counties` is the central hub — five of the eight relationship lines
originate from it.
