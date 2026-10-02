UTILITY EXPLORER

Open "Utility Explorer.html" in Edge, Chrome, or Firefox. No installation,
internet connection, or server is needed. You can copy that one HTML file.

CONTROLS
Drag the 3D plot to rotate; scroll to zoom. Choose Pan and drag to move the
view. The view buttons switch to top, front, or side; Reset view restores 3D.
The + and - buttons also zoom. Full screen enlarges the 3D plot.
On a narrow window, the Controls button opens the settings panel.

Change preferences, alpha, utility scale, income, or prices to update both
plots and the optimum. The camera stays where you put it.
The goods axes stay fixed by default, so budget changes move the plane.
Under Plot range, you can change the limits or enable automatic fitting.

Move the utility-level slider to shift the horizontal plane and its IC.
This releases the "Keep plane at optimal utility" setting. Click "Set plane
to optimum" to put it back at the highest attainable utility. Toggle layers
to show just the parts you want. Reduce surface opacity to see through it.

The vertical budget plane is px*x + py*y = income. The orange curve on the
surface gives utility along this budget line. The red point is an optimum.
The green shaded triangle on the ground shows affordable bundles.

For perfect substitutes with equal utility per unit of expenditure, the
whole budget line is optimal; one representative bundle is reported.
Perfect complements are optimized at their kink. The app does not impose
an interior tangency on corners or kinks.

All quantities are nonnegative. Prices, income, and utility scale are
positive. Supported utility functions are increasing, so optimal bundles
exhaust the budget. Optimization uses analytical solutions. The displayed
surface and contours are sampled approximations; the optimum is exact up
to floating-point arithmetic. The plot range never limits optimization.
Transparent 3D surfaces can visually overlap; layer toggles and the linked
2D plot help inspect intersections.

FUNCTIONS
Cobb-Douglas: A*x^alpha*y^(1-alpha)
CES: A*[alpha*x^rho + (1-alpha)*y^rho]^(1/rho); rho=0 uses Cobb-Douglas.
Perfect substitutes: A*[alpha*x+(1-alpha)*y]
Perfect complements: A*min(x/alpha,y/(1-alpha))
Quasilinear: A*[alpha*ln(1+x)+(1-alpha)*y]

SOURCE AND VERIFICATION
index.html, style.css, app.js, model.js are editable source files.
node build.cjs rebuilds the portable HTML from local assets.
node test-model.cjs checks optima against an independent budget-grid search
and checks that generated IC points have the requested utility.
node serve.cjs optionally previews source at http://127.0.0.1:8765.
Save image exports the current 3D view as a PNG.

Plotly.js 3.1.0 is bundled locally under the MIT license. Its copyright and
license notices are retained in the bundled library. Source:
https://cdn.plot.ly/plotly-3.1.0.min.js
Plotting documentation: https://plotly.com/javascript/3d-surface-plots/
