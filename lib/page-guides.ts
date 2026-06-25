export type PageGuideId =
  | "district-map"
  | "district-summary"
  | "school-dashboard"
  | "floor-plan"
  | "capital-flow"
  | "capital-projects"
  | "school-report"
  | "exports-reporting"

export type TooltipPlacement = "top" | "bottom" | "left" | "right" | "auto"

export interface PageGuideStep {
  title: string
  body: string
  /** Matches `data-guide` on a page element */
  target: string
  placement?: TooltipPlacement
}

export interface PageGuideConfig {
  title: string
  steps: PageGuideStep[]
}

export function guideSelector(target: string) {
  return `[data-guide="${target}"]`
}

export const PAGE_GUIDES: Record<PageGuideId, PageGuideConfig> = {
  "district-map": {
    title: "District Overview — Map",
    steps: [
      {
        target: "school-selector",
        title: "Select a school",
        body: "Choose a campus from the dropdown. Lively Middle School has the fullest demo data — floor plans, FCA line items, and renovation scoping.",
        placement: "bottom",
      },
      {
        target: "main-nav",
        title: "Switch views",
        body: "Use these tabs to move between District Overview, School View, and Capital Planning without losing your school selection.",
        placement: "bottom",
      },
      {
        target: "district-metric",
        title: "Color schools by rating",
        body: "Toggle FCA or ESA to change how pins are colored on the map. The legend in the sidebar updates to match.",
        placement: "right",
      },
      {
        target: "district-capital-totals",
        title: "District capital totals",
        body: "See district-wide FCA deficiency dollars and open ESA projects. Drag the plan year slider to model deferred-cost growth.",
        placement: "right",
      },
      {
        target: "district-filters",
        title: "Filter the portfolio",
        body: "Tap a cell in the FCA × ESA matrix or use the rating filters to narrow which schools appear on the map and in the totals.",
        placement: "right",
      },
      {
        target: "district-map-canvas",
        title: "Explore the map",
        body: "Click a school pin to select it — the map zooms in. Selected schools show detail in the sidebar below the filters.",
        placement: "left",
      },
      {
        target: "district-school-card",
        title: "Open School View",
        body: "After selecting a school, review its FCA and ESA ratings here, then click Open School View for the full campus dashboard.",
        placement: "right",
      },
    ],
  },
  "district-summary": {
    title: "District Overview — Summary",
    steps: [
      {
        target: "district-subnav",
        title: "Map or summary",
        body: "Switch between this district-wide summary and the geographic map to explore individual campuses.",
        placement: "bottom",
      },
      {
        target: "summary-kpis",
        title: "District-wide snapshot",
        body: "These KPI cards summarize how many schools are assessed, average ESA and FCI scores, and total projected FCA backlog.",
        placement: "bottom",
      },
      {
        target: "summary-charts",
        title: "Compare distributions",
        body: "Charts below show rating distributions, FCA deferral projections, ESA project counts, and how schools cluster by condition.",
        placement: "top",
      },
    ],
  },
  "school-dashboard": {
    title: "School View",
    steps: [
      {
        target: "school-selector",
        title: "Change school",
        body: "Switch campuses from the header dropdown. Lively Middle School unlocks the richest floor-plan and capital-planning tools.",
        placement: "bottom",
      },
      {
        target: "school-info-cards",
        title: "Facility snapshot",
        body: "Quick facts — address, building age, square footage, and grades served — for the selected campus.",
        placement: "bottom",
      },
      {
        target: "school-location",
        title: "Location & floor plan",
        body: "The map shows campus location. Click the floor plan preview to open the interactive Floor Plan Explorer.",
        placement: "top",
      },
      {
        target: "school-enrollment",
        title: "Enrollment & capacity",
        body: "Review enrollment, capacity, and utilization bars to see how fully the campus is used.",
        placement: "top",
      },
      {
        target: "school-suitability",
        title: "Suitability & space",
        body: "Educational Adequacy and Space Sufficiency break down how well rooms and programs meet district standards.",
        placement: "top",
      },
      {
        target: "school-facility-needs",
        title: "Facility needs",
        body: "FCA recommendations and system-level deficiencies highlight priority repairs and projected costs.",
        placement: "top",
      },
      {
        target: "main-nav",
        title: "Exports & Reporting",
        body: "Use the Exports & Reporting tab to generate printable facility reports and download GeoJSON or CSV data for the portfolio.",
        placement: "bottom",
      },
    ],
  },
  "floor-plan": {
    title: "Floor Plan Explorer",
    steps: [
      {
        target: "floor-plan-snapshot",
        title: "Building scores",
        body: "The left panel shows campus-wide Educational Adequacy and FCI scores plus condition indicators.",
        placement: "right",
      },
      {
        target: "floor-plan-view-toggle",
        title: "Floor plan or aerial",
        body: "Switch between the annotated floor plan and an aerial campus view for geographic context.",
        placement: "bottom",
      },
      {
        target: "floor-plan-color",
        title: "Color by EA or FCA",
        body: "Shade rooms or buildings by Educational Adequacy or Facility Condition. Use sub-category filters to drill into specific criteria.",
        placement: "bottom",
      },
      {
        target: "floor-plan-levels",
        title: "Change floors",
        body: "For multi-level campuses, pick basement, level 1, 2, or 3 to view room assessments on each floor.",
        placement: "bottom",
      },
      {
        target: "floor-plan-canvas",
        title: "Select a room",
        body: "Click a labeled room or building footprint to open scores, deficiencies, and FCA context. Scroll to zoom; Shift + drag to pan.",
        placement: "left",
      },
      {
        target: "floor-plan-tools",
        title: "Assessment tools",
        body: "Edit scores, rename rooms, log deficiencies, or add assets. These tools are available on campuses with loaded room data.",
        placement: "right",
      },
    ],
  },
  "capital-flow": {
    title: "Capital Planning — Flow Diagram",
    steps: [
      {
        target: "school-selector",
        title: "Pick a school",
        body: "The header school dropdown drives threshold routing for the selected campus. Lively has the richest assessment data.",
        placement: "bottom",
      },
      {
        target: "capital-subnav",
        title: "Flow or projects",
        body: "Switch to School Projects to scope renovations, select FCA line items, and build a capital plan total.",
        placement: "bottom",
      },
      {
        target: "capital-thresholds",
        title: "Adjust strategic thresholds",
        body: "Move the sliders to change enrollment, condition, and closure criteria. The recommended path updates live.",
        placement: "right",
      },
      {
        target: "capital-flow-diagram",
        title: "Follow the recommended path",
        body: "The highlighted route shows the recommended capital strategy. Pan and zoom to explore yes/no decision branches.",
        placement: "left",
      },
      {
        target: "capital-district-table",
        title: "Review district outcomes",
        body: "The classification table shows how every district school routes under the same thresholds.",
        placement: "top",
      },
    ],
  },
  "capital-projects": {
    title: "Capital Planning — School Projects",
    steps: [
      {
        target: "school-selector",
        title: "Pick a school",
        body: "Project lists and floor-plan scoping are tied to the school selected in the header.",
        placement: "bottom",
      },
      {
        target: "capital-renovation",
        title: "Select a project area",
        body: "Click Select project area to open the floor plan. Lasso or click rooms to define renovation scope and see cost estimates.",
        placement: "bottom",
      },
      {
        target: "capital-plan-total",
        title: "Track your plan total",
        body: "As you scope areas and select FCA rows, this card summarizes your plan without double-counting items covered by renovation.",
        placement: "bottom",
      },
      {
        target: "capital-fca-table",
        title: "Pick FCA projects",
        body: "Use Select on table rows to add specific recommendations. Items already covered by renovation show as In renovation.",
        placement: "top",
      },
      {
        target: "capital-esa",
        title: "Review ESA projects",
        body: "Educational Suitability improvements are listed separately. The footer shows the full identified backlog for the campus.",
        placement: "top",
      },
    ],
  },
  "school-report": {
    title: "School Report",
    steps: [
      {
        target: "school-report-actions",
        title: "Print or go back",
        body: "Print / Export PDF opens your browser print dialog. Back to Dashboard returns to the interactive view.",
        placement: "bottom",
      },
      {
        target: "school-report-content",
        title: "Printable summary",
        body: "This report compiles facility condition, enrollment, suitability, and identified needs for the selected school.",
        placement: "top",
      },
    ],
  },
  "exports-reporting": {
    title: "Exports & Reporting",
    steps: [
      {
        target: "school-selector",
        title: "Choose a school",
        body: "Reports and single-school downloads use the school selected in the header. Portfolio exports include all campuses.",
        placement: "bottom",
      },
      {
        target: "main-nav",
        title: "Other views",
        body: "Return to District Overview, School View, or Capital Planning to explore data before exporting.",
        placement: "bottom",
      },
      {
        target: "exports-reports",
        title: "Generate reports",
        body: "Preview a printable facility summary. Optionally include your selected capital plan with floor-plan areas and FCA line items.",
        placement: "bottom",
      },
      {
        target: "exports-downloads",
        title: "Download data",
        body: "Export school locations as GeoJSON or FCA/ESA datasets as CSV. Choose selected school or full portfolio scope.",
        placement: "top",
      },
    ],
  },
}
