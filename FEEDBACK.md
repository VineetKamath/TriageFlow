# Feedback-Driven Improvements

This file tracks concrete UI/UX changes made from tester feedback during TriageFlow iterations.

1. Early testers struggled to quickly distinguish rising-risk zones, especially when amber and red were adjacent -> added pulse animation on amber-to-red transitions and smoother polygon color transitions so escalation is visually obvious.

2. Testers wanted faster presenter control during live walkthroughs -> added keyboard shortcuts (`F`, `R`, `A`, `C`, `O`, `Escape`) plus an on-screen shortcuts hint so critical demo actions can run without mouse travel.

3. Reviewers requested clearer trust and impact framing for judges -> added dedicated Impact/SDG panel with session metrics and downloadable report, plus a landing summary badge showing aggregated trust rate from feedback.

4. Testers said the “zone boxes” didn’t match real places -> replaced the grid with real **Bengaluru ward GeoJSON** polygons and richer unit movement animation.

5. Operators wanted context for monsoon conditions -> added **live rainfall (Open‑Meteo)** which impacts pressure scoring and shows as a header badge + map overlay.

6. Judges wanted an “at-a-glance” optimization story -> added `/optimize` allocation plan + inline optimization summary and forecasting.
