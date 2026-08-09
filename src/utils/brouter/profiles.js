/**
 * Custom BRouter profiles, uploaded to the router at runtime.
 *
 * Standard brouter.de profiles can't express Looply's sidebar criteria:
 * surface preference and street lighting aren't tunable, and sending unknown
 * "profile:" variables to a profile that doesn't declare them fails with
 * HTTP 500. These profiles declare every knob Looply needs, so one upload
 * per activity serves all setting combinations via per-request overrides:
 *
 *   profile:avoid_unpaved=1   penalize soft / unknown surfaces  (Road mode)
 *   profile:prefer_unpaved=1  penalize sealed surfaces          (Unpaved mode)
 *   profile:prefer_lit=1      penalize unlit / unknown-lit ways (Well-Lit)
 *   profile:uphillcost=N      cost per climbed meter            (Terrain)
 *   profile:downhillcost=N    cost per descended meter          (Terrain)
 *   profile:road_aversion=N   run only — scales car-road surcharge
 *   profile:avoid_unsafe=1    bike only — penalize roads without bike infra
 *   profile:mtb=1             bike only — welcome singletrack & rough tracks
 *
 * The lighting preference works because brouter.de's segment data encodes
 * the OSM `lit` tag (see lookups.dat) — standard profiles just never
 * reference it. The same holds for `maxspeed` and `sidewalk`, which the run
 * profile uses to keep runners off fast roads that have no footway; note
 * lookups.dat stores maxspeed only as round decades (60, 70, … 130) and has
 * no `width` lookup at all.
 *
 * Measurement trap: `processUnusedTags = false` means BRouter echoes only the
 * tags a profile actually references. Comparing a route against an older
 * profile therefore needs a report-only `assign dummyUsage = <tag>=` on BOTH
 * sides, or the older one looks clean simply because it can't see the tag.
 *
 * The bike profile is derived from BRouter's standard trekking profile
 * (misc/profiles2/trekking.brf); the run profile is a foot-access variant
 * on the same skeleton.
 */

const SURFACE_AND_LIGHT_BLOCK = `
# Looply surface / lighting classification
assign hardsurface = surface=paved|asphalt|concrete|paving_stones|sett|cobblestone|wood|metal|grass_paver
assign softsurface = surface=unpaved|gravel|ground|dirt|grass|compacted|sand|pebblestone|fine_gravel|earth|mud|clay|rock|stone
assign trackish = highway=track|path|bridleway
assign islit = lit=yes|automatic

# extra cost added onto every way's costfactor, driven by the request
assign surfaceprefpenalty =
  add ( if ( and avoid_unpaved softsurface ) then 3.0 else 0 )
  add ( if ( and avoid_unpaved ( and surface= trackish ) ) then 2.0 else 0 )
  add ( if ( and prefer_unpaved hardsurface ) then 1.2 else 0 )
      ( if ( and prefer_lit not islit ) then ( if lit=no then 2.0 else 0.8 ) else 0 )

# Stay on public roads and paths: penalize private-ish ways (driveways,
# parking aisles, customer/delivery areas, indoor corridors) without hard
# exclusion — the start point itself often sits on a driveway. Ways tagged
# access=private (and its aliases: restricted, residents, employees) are
# already excluded by the access logic.
assign privatepenalty =
  add ( if highway=corridor then 20 else 0 )
  add ( if ( and highway=service service=driveway|parking_aisle|drive-through|emergency_access|parking ) then 4.0 else 0 )
  add ( if ( and highway=service service= ) then 0.6 else 0 )
      ( if access=customers|delivery then 1.5 else 0 )
`;

export const LOOPLY_BIKE_PROFILE = `# Looply cycling profile — derived from BRouter's standard trekking profile,
# with per-request tunables for surface, lighting, and elevation preference.

---context:global

assign validForBikes = true

# Looply tunables — overridden per request via profile:<name>=<value>
assign avoid_unpaved  = false
assign prefer_unpaved = false
assign prefer_lit     = false
assign allow_steps    = true
assign allow_ferries  = true

# MTB style: singletrack (path/bridleway, rough tracktypes) is welcome.
# Without it, prefer_unpaved means gravel style: smooth forest tracks are
# ideal but technical singletrack is avoided.
assign mtb = false

assign consider_elevation = true
assign downhillcost       = 60
assign downhillcutoff     = 1.5
assign uphillcost         = 0
assign uphillcutoff       = 1.5
assign downhillcost       = if consider_elevation then downhillcost else 0
assign uphillcost         = if consider_elevation then uphillcost else 0

assign ignore_cycleroutes       = false
assign stick_to_cycleroutes     = false
assign use_proposed_cycleroutes = false
assign avoid_unsafe             = false

assign totalMass  = 90
assign maxSpeed   = 45
assign S_C_x      = 0.225
assign C_r        = 0.01
assign bikerPower = 100

assign turnInstructionMode      = 0
assign considerTurnRestrictions = true
assign processUnusedTags        = false

---context:way

assign classifier_none  = 1
assign classifier_ferry = 2

assign any_cycleroute =
  if not use_proposed_cycleroutes then
     if      route_bicycle_icn=yes then true
     else if route_bicycle_ncn=yes then true
     else if route_bicycle_rcn=yes then true
     else if route_bicycle_lcn=yes then true
     else false
  else
     if      route_bicycle_icn=yes|proposed then true
     else if route_bicycle_ncn=yes|proposed then true
     else if route_bicycle_rcn=yes|proposed then true
     else if route_bicycle_lcn=yes|proposed then true
     else false

assign nodeaccessgranted =
     if any_cycleroute then true
     else lcn=yes

assign is_ldcr =
     if ignore_cycleroutes then false
     else any_cycleroute

assign hasbikerouteoraccess =
       or bicycle_road=yes or cyclestreet=yes or bicycle=yes|permissive|designated lcn=yes

assign hascycleway = not
  and ( or cycleway= cycleway=no|none ) and ( or cycleway:left= cycleway:left=no ) and ( or cycleway:right= cycleway:right=no ) ( or cycleway:both= cycleway:both=no )

assign isbike = or hasbikerouteoraccess hascycleway

assign ispaved = or surface=paved|asphalt|concrete|paving_stones|sett smoothness=excellent|good
assign isunpaved = not or ispaved or ( and surface= smoothness= ) or surface=fine_gravel|cobblestone smoothness=intermediate|bad
assign probablyGood = or ispaved and ( or isbike highway=footway ) not isunpaved
${SURFACE_AND_LIGHT_BLOCK}
assign turncost = if is_ldcr then 0
                  else if junction=roundabout then 0
                  else 90

assign initialclassifier =
     if route=ferry then classifier_ferry
     else classifier_none

assign initialcost =
     if ( equal initialclassifier classifier_ferry ) then 10000
     else 0

assign defaultaccess =
       if access= then not motorroad=yes
       else if access=private|no then false
       else true

assign bikeaccess =
       if bicycle= then
       (
         if bicycle_road=yes then true
         else if vehicle= then ( if highway=footway then false else defaultaccess )
         else not vehicle=private|no
       )
       else not bicycle=private|no|dismount|use_sidepath

assign footaccess =
       if bicycle=dismount then true
       else if foot= then defaultaccess
       else not foot=private|no|use_sidepath

assign accesspenalty =
       if bikeaccess then 0
       else if footaccess then 4
       else if any_cycleroute then 15
       else if bicycle=use_sidepath then 25
       else 10000

assign badoneway =
       if reversedirection=yes then
         if oneway:bicycle=yes then true
         else if oneway= then junction=roundabout
         else oneway=yes|true|1
       else oneway=-1

assign onewaypenalty =
       if ( badoneway ) then
       (
         if (
           and hascycleway
           or and cycleway:left=lane|track|shared_lane|share_busway
                  cycleway:left:oneway=no|-1
           or and cycleway:right=lane|track|shared_lane|share_busway
                  cycleway:right:oneway=no|-1
           or and cycleway:both=lane|track|shared_lane|share_busway
                  or cycleway:left:oneway=no|-1
                     cycleway:right:oneway=no|-1
           or cycleway=opposite|opposite_lane|opposite_track
           or cycleway:left=opposite|opposite_lane|opposite_track
              cycleway:right=opposite|opposite_lane|opposite_track
                                                             ) then 0
         else if ( oneway:bicycle=no                         ) then 0
         else if ( not footaccess                            ) then 100
         else if ( junction=roundabout|circular              ) then 60
         else if ( highway=primary|primary_link              ) then 50
         else if ( highway=secondary|secondary_link          ) then 30
         else if ( highway=tertiary|tertiary_link            ) then 20
         else 4.0
       )
       else 0.0

assign isresidentialorliving = or highway=residential|living_street living_street=yes

assign costfactor

  if ( and highway= not route=ferry ) then 10000

  else if ( highway=motorway|motorway_link          ) then   10000
  else if ( highway=proposed|abandoned|construction ) then   10000

  else min 9999

  add surfaceprefpenalty

  add privatepenalty

  add max onewaypenalty accesspenalty

  if ( highway=steps ) then ( if allow_steps then 40 else 10000 )
  else if ( route=ferry   ) then ( if allow_ferries then 5.67 else 10000 )

  else if ( is_ldcr ) then 1
  else
  add ( if stick_to_cycleroutes then 0.5 else 0.05 )

  if      ( highway=pedestrian                ) then ( if isbike then ( if hascycleway then 1.1 else 2.2 ) else 3 )
  else if ( highway=bridleway                 ) then ( if mtb then 1.0 else if prefer_unpaved then 1.5 else 5 )
  else if ( highway=cycleway                  ) then 1
  else if ( isresidentialorliving             ) then ( if isunpaved then 1.5 else 1.1 )
  else if ( highway=service                   ) then ( if isunpaved then 1.6 else 1.3 )

  else if ( highway=track|road|path|footway ) then
  (
    # MTB: singletrack and rough tracks are the point
    if ( mtb ) then ( if tracktype=grade4|grade5 then 1.1 else 1.0 )
    # gravel: smooth unpaved tracks are ideal, technical singletrack is not
    else if ( prefer_unpaved ) then
    (
      if ( highway=path|footway ) then 1.8
      else if ( tracktype=grade4|grade5 ) then 1.8
      else 1.0
    )
    else if ( tracktype=grade1 ) then ( if probablyGood then 1.0 else 1.3 )
    else if ( tracktype=grade2 ) then ( if probablyGood then 1.1 else 2.0 )
    else if ( tracktype=grade3 ) then ( if probablyGood then 1.5 else 3.0 )
    else if ( tracktype=grade4 ) then ( if probablyGood then 2.0 else 5.0 )
    else if ( tracktype=grade5 ) then ( if probablyGood then 3.0 else 5.0 )
    else                              ( if probablyGood then 1.0 else 5.0 )
  )

  else add ( if ( and avoid_unsafe not isbike ) then 2 else 0 )

       if ( highway=trunk|trunk_link         ) then ( if isbike then 1.5 else 10  )
  else if ( highway=primary|primary_link     ) then ( if isbike then 1.2 else  3  )
  else if ( highway=secondary|secondary_link ) then ( if isbike then 1.1 else 1.6 )
  else if ( highway=tertiary|tertiary_link   ) then ( if isbike then 1.0 else 1.4 )
  else if ( highway=unclassified             ) then ( if isbike then 1.0 else 1.3 )

  else 2.0

assign priorityclassifier =

  if      ( highway=motorway                          ) then  30
  else if ( highway=motorway_link                     ) then  29
  else if ( highway=trunk                             ) then  28
  else if ( highway=trunk_link                        ) then  27
  else if ( highway=primary                           ) then  26
  else if ( highway=primary_link                      ) then  25
  else if ( highway=secondary                         ) then  24
  else if ( highway=secondary_link                    ) then  23
  else if ( highway=tertiary                          ) then  22
  else if ( highway=tertiary_link                     ) then  21
  else if ( highway=unclassified                      ) then  20
  else if ( isresidentialorliving                     ) then  6
  else if ( highway=service                           ) then  6
  else if ( highway=cycleway                          ) then  6
  else if ( or bicycle=designated bicycle_road=yes    ) then  6
  else if ( highway=track                             ) then if tracktype=grade1 then 6 else 4
  else if ( highway=bridleway|road|path|footway       ) then  4
  else if ( highway=steps                             ) then  2
  else if ( highway=pedestrian                        ) then  2
  else 0

assign isbadoneway = not equal onewaypenalty 0
assign isgoodoneway = if reversedirection=yes then oneway=-1
                      else if oneway= then junction=roundabout else oneway=yes|true|1
assign isroundabout = junction=roundabout
assign islinktype = highway=motorway_link|trunk_link|primary_link|secondary_link|tertiary_link
assign isgoodforcars = if greater priorityclassifier 6 then true
                  else if ( or isresidentialorliving highway=service ) then true
                  else if ( and highway=track tracktype=grade1 ) then true
                  else false

assign classifiermask add          isbadoneway
                      add multiply isgoodoneway   2
                      add multiply isroundabout   4
                      add multiply islinktype     8
                          multiply isgoodforcars 16

# keep smoothness in the response's WayTags for client-side surface analysis
assign dummyUsage = smoothness=

---context:node

assign defaultaccess =
       if ( access= ) then true
       else if ( access=private|no ) then false
       else true

assign bikeaccess =
       if nodeaccessgranted=yes then true
       else if bicycle= then
       (
         if vehicle= then defaultaccess
         else not vehicle=private|no
       )
       else not bicycle=private|no|dismount

assign footaccess =
       if bicycle=dismount then true
       else if foot= then defaultaccess
       else not foot=private|no

assign initialcost =
       if or highway=traffic_signals and highway=crossing crossing=traffic_signals then 20
       else
       if bikeaccess then 0
       else ( if footaccess then 100 else 1000000 )
`;

export const LOOPLY_RUN_PROFILE = `# Looply running profile — foot-access routing with per-request tunables
# for surface, lighting, and elevation preference.

---context:global

assign validForFoot = true

# Looply tunables — overridden per request via profile:<name>=<value>
assign avoid_unpaved  = false
assign prefer_unpaved = false
assign prefer_lit     = false
assign allow_steps    = true
assign allow_ferries  = true

# Scales the surcharge on car-traffic roads (0 = roads cost like quiet
# streets, 1 = defaults, >1 = strongly avoid). At 1 the class costs are
# unclassified 1.5, tertiary 1.6, secondary 2.0, primary 2.8, trunk 6.0.
assign road_aversion  = 1

assign consider_elevation = true
assign downhillcost       = 0
assign downhillcutoff     = 1.5
assign uphillcost         = 0
assign uphillcutoff       = 1.5
assign downhillcost       = if consider_elevation then downhillcost else 0
assign uphillcost         = if consider_elevation then uphillcost else 0

assign turnInstructionMode      = 0
assign considerTurnRestrictions = false
assign processUnusedTags        = false

---context:way

assign classifier_none  = 1
assign classifier_ferry = 2

assign turncost = 0

assign initialclassifier =
     if route=ferry then classifier_ferry
     else classifier_none

assign initialcost =
     if ( equal initialclassifier classifier_ferry ) then 10000
     else 0

assign defaultaccess =
       if access= then not motorroad=yes
       else if access=private|no then false
       else true

assign footaccess =
       if foot= then defaultaccess
       else not foot=private|no|use_sidepath

assign accesspenalty =
       if footaccess then 0
       else 10000
${SURFACE_AND_LIGHT_BLOCK}
# Traffic safety: running on the carriageway of a fast road is dangerous, so
# cost scales with posted speed whenever the way has no separate foot
# infrastructure. OSM leaves \`sidewalk\` untagged on most rural roads, so an
# absent tag is read as "no sidewalk" — the conservative direction for a safety
# rule. Deliberately NOT tunable: road_aversion is a preference, this is not.
assign hasfootway = or sidewalk=yes|both|left|right|separate
                    or sidewalk:both=yes
                    or sidewalk:left=yes
                    or sidewalk:right=yes
                       foot=designated|yes

# brouter's lookup table only holds round-decade maxspeed values, so these
# enumerations are exhaustive rather than a range check.
# Magnitudes are calibrated, not guessed: over 24 sampled 13 km loops these
# are the knee of the curve. Raising them further stops removing exposure
# (what remains is connectors with no alternative) and only adds detour.
assign unsafespeedpenalty =
       if hasfootway                then 0
  else if maxspeed=100|110|120|130  then 300
  else if maxspeed=80|90            then 120
  else if maxspeed=70               then 60
  else if maxspeed=60               then 25
  # trunk and primary carry fast traffic even where maxspeed is untagged
  else if ( and maxspeed= highway=trunk|trunk_link     ) then 300
  else if ( and maxspeed= highway=primary|primary_link ) then 60
  else 0

# A path worth running on: signposted for foot use, a known surface, or a
# graded track. Anything else is unmarked singletrack — the point when the
# runner asked for trails, a downgrade from the wider way alongside when they
# did not.
assign wellformedpath =
  or foot=designated
  or surface=paved|asphalt|concrete|paving_stones|sett|compacted|fine_gravel|gravel|wood
     tracktype=grade1|grade2

assign isresidentialorliving = or highway=residential|living_street living_street=yes

assign costfactor

  if ( and highway= not route=ferry ) then 10000

  else if ( highway=motorway|motorway_link          ) then 10000
  else if ( highway=proposed|abandoned|construction ) then 10000

  else min 9999

  add surfaceprefpenalty

  add privatepenalty

  add accesspenalty

  add unsafespeedpenalty

  if ( highway=steps ) then ( if allow_steps then 1.8 else 10000 )
  else if ( route=ferry ) then ( if allow_ferries then 5.67 else 10000 )

  else if ( highway=pedestrian|footway        ) then 1.0
  else if ( highway=cycleway                  ) then 1.0
  else if ( highway=path                      ) then
  (
    # trail mode asks for singletrack; otherwise prefer the way alongside.
    # 2.5 is deliberately moderate: it wins whenever a larger path runs
    # nearby, without making the router allergic to trails that have no
    # alternative. Pushing it to 4.0 only bought another 1.1 percentage
    # points of avoidance across the sample.
    if prefer_unpaved     then 1.0
    else if wellformedpath then 1.15
    else                        2.5
  )
  else if ( highway=track|road                ) then ( if tracktype=grade4|grade5 then 1.5 else 1.1 )
  else if ( highway=bridleway                 ) then 1.2
  else if ( isresidentialorliving             ) then 1.2
  else if ( highway=service                   ) then 1.4
  else if ( highway=unclassified              ) then ( add 1.2 multiply 0.3 road_aversion )
  else if ( highway=tertiary|tertiary_link    ) then ( add 1.2 multiply 0.4 road_aversion )
  else if ( highway=secondary|secondary_link  ) then ( add 1.2 multiply 0.8 road_aversion )
  else if ( highway=primary|primary_link      ) then ( add 1.2 multiply 1.6 road_aversion )
  else if ( highway=trunk|trunk_link          ) then ( add 1.2 multiply 4.8 road_aversion )

  else 2.0

assign priorityclassifier =

  if      ( highway=motorway|motorway_link            ) then  30
  else if ( highway=trunk|trunk_link                  ) then  28
  else if ( highway=primary|primary_link              ) then  26
  else if ( highway=secondary|secondary_link          ) then  24
  else if ( highway=tertiary|tertiary_link            ) then  22
  else if ( highway=unclassified                      ) then  20
  else if ( isresidentialorliving                     ) then  6
  else if ( highway=service                           ) then  6
  else if ( highway=cycleway                          ) then  6
  else if ( highway=track                             ) then  4
  else if ( highway=bridleway|road|path|footway       ) then  4
  else if ( highway=steps                             ) then  2
  else if ( highway=pedestrian                        ) then  2
  else 0

assign isbadoneway = false
assign isgoodoneway = if reversedirection=yes then oneway=-1
                      else if oneway= then junction=roundabout else oneway=yes|true|1
assign isroundabout = junction=roundabout
assign islinktype = highway=motorway_link|trunk_link|primary_link|secondary_link|tertiary_link
assign isgoodforcars = greater priorityclassifier 6

assign classifiermask add          isbadoneway
                      add multiply isgoodoneway   2
                      add multiply isroundabout   4
                      add multiply islinktype     8
                          multiply isgoodforcars 16

# keep smoothness in the response's WayTags for client-side surface analysis
assign dummyUsage = smoothness=

---context:node

assign defaultaccess =
       if ( access= ) then true
       else if ( access=private|no ) then false
       else true

assign footaccess =
       if foot= then defaultaccess
       else not foot=private|no

assign initialcost =
       if footaccess then 0
       else 1000000
`;
