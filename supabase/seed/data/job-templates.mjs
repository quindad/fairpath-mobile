// Job templates for the DEV inventory seed. Pay ranges are base (national-average-ish) figures that
// build-inventory.mjs scales by each market's wage index. Nothing here is a real posting.
//
// t(key, industry, title, min, max, unit, type, wp, sched, exp, edu, skills, summary, certs?)
//   unit  : 'hour' | 'week' | 'year'          (jobs_pay_period_check: hour/day/week/month/year)
//   type  : full_time | part_time | contract | temporary | internship | gig   (jobs_employment_type_check)
//   wp    : O = onsite only, OH = onsite/hybrid, ROH = remote/hybrid/onsite, R = remote/hybrid
//   sched : key into SCHEDULES below

export const INDUSTRIES = [
  'warehouse_logistics', 'manufacturing', 'construction', 'skilled_trades', 'hospitality', 'food_service',
  'healthcare_support', 'transportation', 'customer_service', 'office_admin', 'technology', 'retail',
];

export const INDUSTRY_LABEL = {
  warehouse_logistics: 'Warehouse & Logistics', manufacturing: 'Manufacturing', construction: 'Construction', skilled_trades: 'Skilled Trades',
  hospitality: 'Hospitality', food_service: 'Food Service', healthcare_support: 'Healthcare Support', transportation: 'Transportation',
  customer_service: 'Customer Service', office_admin: 'Office & Administration', technology: 'Technology', retail: 'Retail',
};

export const SCHEDULES = {
  shifts: ['1st shift', '2nd shift', '3rd shift', 'Overtime available'],
  day: ['Monday-Friday', 'Day shift'],
  rotating: ['Rotating shifts', 'Weekends required', 'Overtime available'],
  flex: ['Flexible hours', 'Weekends', 'Evening shift'],
  hospitality: ['Rotating shifts', 'Weekends', 'Holidays', 'Evening shift'],
  kitchen: ['Split shift', 'Weekends', 'Evening shift', 'Early morning'],
  tenten: ['4x10 schedule', 'Day shift', 'Overtime available'],
  route: ['Early morning', 'Monday-Friday', 'Weekends'],
  office: ['Monday-Friday', 'Day shift', 'Hybrid schedule available'],
  care: ['12-hour shifts', 'Rotating shifts', 'Weekends', 'Night shift'],
};

const T = (key, industry, title, min, max, unit, type, wp, sched, exp, edu, skills, summary, certs = []) =>
  ({ key, industry, title, min, max, unit, type, wp, sched, exp, edu, skills, summary, certs });

export const JOB_TEMPLATES = [
  // ---- warehouse_logistics -----------------------------------------------------------------
  T('wh-associate', 'warehouse_logistics', 'Warehouse Associate', 17, 20, 'hour', 'full_time', 'O', 'shifts', 'Entry level', 'No formal education required', ['Lifting up to 50 lbs', 'RF scanner', 'Attention to detail'], 'Receive, stage and move inventory through a busy distribution center.'),
  T('wh-forklift', 'warehouse_logistics', 'Forklift Operator', 20, 24, 'hour', 'full_time', 'O', 'shifts', '1-2 years', 'High school diploma or GED preferred', ['Sit-down and stand-up forklifts', 'Safety compliance', 'Inventory accuracy'], 'Operate powered equipment to load, unload and stage pallets.', ['Forklift certification (or willingness to certify)']),
  T('wh-picker', 'warehouse_logistics', 'Order Picker / Packer', 16.5, 19, 'hour', 'full_time', 'O', 'shifts', 'Entry level', 'No formal education required', ['Pick-to-light systems', 'Packing', 'Speed and accuracy'], 'Pick and pack customer orders to daily productivity targets.'),
  T('wh-receiving', 'warehouse_logistics', 'Shipping & Receiving Clerk', 18, 21, 'hour', 'full_time', 'O', 'day', 'Some experience', 'High school diploma or GED', ['Bills of lading', 'Data entry', 'Cycle counts'], 'Verify inbound and outbound freight against paperwork and update inventory systems.'),
  T('wh-inventory', 'warehouse_logistics', 'Inventory Control Specialist', 19, 23, 'hour', 'full_time', 'O', 'day', '1-2 years', 'High school diploma or GED', ['Cycle counting', 'WMS software', 'Spreadsheets'], 'Audit stock locations and resolve inventory discrepancies.'),
  T('wh-lead', 'warehouse_logistics', 'Loading Dock Team Lead', 21, 26, 'hour', 'full_time', 'O', 'shifts', '2+ years', 'High school diploma or GED', ['Team leadership', 'Scheduling', 'Safety coaching'], 'Lead a dock crew, balance workloads and keep trailers turning on time.'),
  T('wh-parttime', 'warehouse_logistics', 'Fulfillment Associate (Part-Time)', 16, 18, 'hour', 'part_time', 'O', 'flex', 'Entry level', 'No formal education required', ['Packing', 'Scanning', 'Reliability'], 'Part-time evening and weekend fulfillment work with predictable hours.'),

  // ---- manufacturing -------------------------------------------------------------------------
  T('mf-operator', 'manufacturing', 'Production Operator', 17, 21, 'hour', 'full_time', 'O', 'shifts', 'Entry level', 'High school diploma or GED preferred', ['Machine tending', 'Following work instructions', 'Basic math'], 'Run production equipment and meet quality and output standards.'),
  T('mf-cnc', 'manufacturing', 'CNC Machine Operator', 21, 28, 'hour', 'full_time', 'O', 'shifts', '1-2 years', 'Certification or trade program', ['CNC operation', 'Blueprint reading', 'Micrometers and calipers'], 'Set up and run CNC mills and lathes to tight tolerances.'),
  T('mf-assembler', 'manufacturing', 'Assembler', 16, 19, 'hour', 'full_time', 'O', 'shifts', 'Entry level', 'No formal education required', ['Hand tools', 'Fine motor skills', 'Following work instructions'], 'Assemble components into finished products on a production line.'),
  T('mf-inspector', 'manufacturing', 'Quality Inspector', 19, 24, 'hour', 'full_time', 'O', 'day', 'Some experience', 'High school diploma or GED', ['Inspection gauges', 'Documentation', 'Attention to detail'], 'Inspect parts and assemblies and document conformance to specification.'),
  T('mf-welder', 'manufacturing', 'Welder / Fabricator', 22, 30, 'hour', 'full_time', 'O', 'shifts', '2+ years', 'Certification or trade program', ['MIG and TIG welding', 'Blueprint reading', 'Metal fabrication'], 'Weld and fabricate structural and custom metal components.', ['Welding certification (AWS or equivalent)']),
  T('mf-setup', 'manufacturing', 'Machine Setup Technician', 25, 33, 'hour', 'full_time', 'O', 'tenten', '3+ years', 'Associate degree preferred', ['Machine setup', 'Troubleshooting', 'Preventive maintenance'], 'Set up and troubleshoot production machinery to minimize downtime.'),
  T('mf-packaging', 'manufacturing', 'Packaging Operator (Part-Time)', 16, 18.5, 'hour', 'part_time', 'O', 'flex', 'Entry level', 'No formal education required', ['Packaging lines', 'Lifting', 'Reliability'], 'Operate packaging equipment on a part-time rotating schedule.'),

  // ---- construction --------------------------------------------------------------------------
  T('cn-laborer', 'construction', 'General Laborer', 17, 21, 'hour', 'full_time', 'O', 'tenten', 'Entry level', 'No formal education required', ['Manual labor', 'Hand and power tools', 'Site cleanup'], 'Support construction crews with site preparation, material handling and cleanup.'),
  T('cn-carpenter-helper', 'construction', "Carpenter's Helper", 18, 23, 'hour', 'full_time', 'O', 'tenten', 'Some experience', 'No formal education required', ['Measuring', 'Framing basics', 'Tool care'], 'Assist carpenters with framing, trim and finish work.'),
  T('cn-concrete', 'construction', 'Concrete Finisher', 22, 29, 'hour', 'full_time', 'O', 'tenten', '2+ years', 'No formal education required', ['Concrete finishing', 'Forming', 'Screeding'], 'Place, finish and cure concrete flatwork and structural elements.'),
  T('cn-operator', 'construction', 'Heavy Equipment Operator', 26, 35, 'hour', 'full_time', 'O', 'tenten', '3+ years', 'High school diploma or GED', ['Excavators and loaders', 'Grade reading', 'Equipment maintenance'], 'Operate excavators, loaders and dozers on commercial and civil projects.', ['Valid driver license']),
  T('cn-roofer', 'construction', 'Roofing Crew Member', 18, 24, 'hour', 'full_time', 'O', 'tenten', 'Entry level', 'No formal education required', ['Working at heights', 'Shingle installation', 'Safety practices'], 'Install and repair residential and commercial roofing systems.'),
  T('cn-safety', 'construction', 'Site Safety Coordinator', 52000, 68000, 'year', 'full_time', 'O', 'day', '3+ years', 'Certification or trade program', ['OSHA standards', 'Incident reporting', 'Toolbox talks'], 'Run jobsite safety programs, inspections and training for project crews.', ['OSHA 30 (or equivalent)']),
  T('cn-painter', 'construction', 'Commercial Painter', 18, 25, 'hour', 'full_time', 'O', 'tenten', 'Some experience', 'No formal education required', ['Surface prep', 'Spray and roll', 'Color matching'], 'Prepare and paint interior and exterior surfaces on commercial projects.'),

  // ---- skilled_trades ------------------------------------------------------------------------
  T('st-hvac', 'skilled_trades', 'HVAC Installer / Apprentice', 18, 24, 'hour', 'full_time', 'O', 'day', 'Apprentice / trainee', 'Certification or trade program', ['Ductwork', 'Refrigerant handling', 'Customer service'], 'Install and service heating and cooling systems while training toward journeyman status.'),
  T('st-electrician', 'skilled_trades', 'Journeyman Electrician', 30, 42, 'hour', 'full_time', 'O', 'tenten', '3+ years', 'Certification or trade program', ['Commercial wiring', 'Code compliance', 'Troubleshooting'], 'Install and maintain electrical systems on commercial and industrial jobs.', ['State journeyman electrician license']),
  T('st-plumber', 'skilled_trades', 'Plumber Apprentice', 17, 22, 'hour', 'full_time', 'O', 'day', 'Apprentice / trainee', 'High school diploma or GED', ['Pipe fitting', 'Blueprint reading', 'Hand tools'], 'Learn the plumbing trade on the job with a paid apprenticeship.'),
  T('st-auto', 'skilled_trades', 'Automotive Technician', 22, 32, 'hour', 'full_time', 'O', 'rotating', '2+ years', 'Certification or trade program', ['Diagnostics', 'Brakes and suspension', 'Customer communication'], 'Diagnose and repair light-duty vehicles at a busy service center.', ['ASE certification preferred']),
  T('st-diesel', 'skilled_trades', 'Diesel Mechanic', 26, 36, 'hour', 'full_time', 'O', 'rotating', '3+ years', 'Certification or trade program', ['Diesel engines', 'Air brakes', 'Electrical diagnostics'], 'Maintain and repair heavy-duty trucks and trailers.', ['Valid driver license']),
  T('st-maint-tech', 'skilled_trades', 'Building Maintenance Technician', 20, 27, 'hour', 'full_time', 'O', 'day', '1-2 years', 'High school diploma or GED', ['General repair', 'HVAC basics', 'Work order systems'], 'Keep commercial and multifamily properties safe and in working order.'),
  T('st-industrial-maint', 'skilled_trades', 'Industrial Maintenance Mechanic', 26, 34, 'hour', 'full_time', 'O', 'shifts', '3+ years', 'Associate degree preferred', ['PLC basics', 'Hydraulics and pneumatics', 'Preventive maintenance'], 'Maintain production equipment and reduce unplanned downtime.'),

  // ---- hospitality ---------------------------------------------------------------------------
  T('hs-front-desk', 'hospitality', 'Hotel Front Desk Agent', 15, 19, 'hour', 'full_time', 'O', 'hospitality', 'Entry level', 'High school diploma or GED', ['Guest service', 'Reservation systems', 'Cash handling'], 'Welcome guests, manage reservations and resolve service requests.'),
  T('hs-housekeeper', 'hospitality', 'Housekeeper', 15, 18, 'hour', 'full_time', 'O', 'day', 'Entry level', 'No formal education required', ['Cleaning standards', 'Time management', 'Attention to detail'], 'Clean and prepare guest rooms and public areas to brand standards.'),
  T('hs-banquet', 'hospitality', 'Banquet Server (Part-Time)', 14, 17, 'hour', 'part_time', 'O', 'hospitality', 'Entry level', 'No formal education required', ['Table service', 'Teamwork', 'Standing for long periods'], 'Serve at weddings, conferences and events. Gratuities in addition to hourly pay.'),
  T('hs-engineer', 'hospitality', 'Hotel Maintenance Engineer', 20, 26, 'hour', 'full_time', 'O', 'rotating', '1-2 years', 'High school diploma or GED', ['General repair', 'HVAC basics', 'Pool and plumbing'], 'Maintain hotel systems, guest rooms and building equipment.'),
  T('hs-night-audit', 'hospitality', 'Night Auditor', 17, 21, 'hour', 'full_time', 'O', 'hospitality', 'Some experience', 'High school diploma or GED', ['Night audit close', 'Cash reconciliation', 'Guest service'], 'Run overnight front desk operations and balance the daily audit.'),
  T('hs-event-crew', 'hospitality', 'Event Setup Crew', 15, 20, 'hour', 'gig', 'O', 'flex', 'Entry level', 'No formal education required', ['Lifting', 'Setup and teardown', 'Reliability'], 'Set up and break down staging, tables and equipment for events. Per-event scheduling.'),

  // ---- food_service --------------------------------------------------------------------------
  T('fs-line-cook', 'food_service', 'Line Cook', 16, 21, 'hour', 'full_time', 'O', 'kitchen', '1-2 years', 'No formal education required', ['Grill and saute', 'Food safety', 'Speed under pressure'], 'Prepare menu items to spec during high-volume service.'),
  T('fs-prep-cook', 'food_service', 'Prep Cook', 15, 18, 'hour', 'full_time', 'O', 'kitchen', 'Entry level', 'No formal education required', ['Knife skills', 'Food safety', 'Organization'], 'Prep ingredients and stations so the line runs smoothly.'),
  T('fs-dishwasher', 'food_service', 'Dishwasher', 14, 17, 'hour', 'full_time', 'O', 'kitchen', 'Entry level', 'No formal education required', ['Sanitation', 'Teamwork', 'Standing for long periods'], 'Keep dishes, pots and the kitchen clean and stocked.'),
  T('fs-manager', 'food_service', 'Kitchen Manager', 48000, 62000, 'year', 'full_time', 'O', 'kitchen', '3+ years', 'High school diploma or GED', ['Ordering and inventory', 'Team leadership', 'Cost control'], 'Run back-of-house operations, scheduling and food cost.', ['ServSafe Manager (or willingness to certify)']),
  T('fs-server', 'food_service', 'Server', 10, 14, 'hour', 'part_time', 'O', 'hospitality', 'Entry level', 'No formal education required', ['Customer service', 'Menu knowledge', 'Multitasking'], 'Serve guests in a casual dining room. Base wage plus tips.'),
  T('fs-baker', 'food_service', 'Baker', 16, 20, 'hour', 'full_time', 'O', 'kitchen', 'Some experience', 'No formal education required', ['Dough handling', 'Baking schedules', 'Food safety'], 'Produce breads and pastries in an early-morning production bakery.'),

  // ---- healthcare_support --------------------------------------------------------------------
  T('hc-cna', 'healthcare_support', 'Certified Nursing Assistant', 17, 22, 'hour', 'full_time', 'O', 'care', 'Some experience', 'Certification or trade program', ['Patient care', 'Vitals', 'Compassion'], 'Provide daily personal care and support to residents under nursing supervision.', ['State nurse aide certification']),
  T('hc-transporter', 'healthcare_support', 'Patient Transporter', 16, 19, 'hour', 'full_time', 'O', 'care', 'Entry level', 'High school diploma or GED', ['Patient handling', 'Infection control', 'Communication'], 'Safely transport patients between units and departments.'),
  T('hc-sterile', 'healthcare_support', 'Sterile Processing Technician', 20, 26, 'hour', 'full_time', 'O', 'care', '1-2 years', 'Certification or trade program', ['Instrument decontamination', 'Sterilization', 'Documentation'], 'Clean, assemble and sterilize surgical instruments and equipment.', ['CRCST certification (or willingness to certify)']),
  T('hc-records', 'healthcare_support', 'Medical Records Clerk', 17, 21, 'hour', 'full_time', 'OH', 'office', 'Some experience', 'High school diploma or GED', ['Records management', 'Data accuracy', 'Confidentiality'], 'Maintain and release patient records in compliance with privacy rules.'),
  T('hc-hha', 'healthcare_support', 'Home Health Aide', 15, 19, 'hour', 'part_time', 'O', 'flex', 'Entry level', 'High school diploma or GED', ['Personal care', 'Meal preparation', 'Dependability'], 'Support clients with daily living activities in their homes.'),
  T('hc-evs', 'healthcare_support', 'Environmental Services Technician', 15, 19, 'hour', 'full_time', 'O', 'care', 'Entry level', 'No formal education required', ['Cleaning protocols', 'Infection prevention', 'Teamwork'], 'Keep patient rooms and clinical areas clean and safe.'),
  T('hc-phleb', 'healthcare_support', 'Phlebotomist', 19, 24, 'hour', 'full_time', 'O', 'day', '1-2 years', 'Certification or trade program', ['Venipuncture', 'Specimen handling', 'Patient communication'], 'Collect and label blood specimens for laboratory testing.', ['Phlebotomy certification']),

  // ---- transportation ------------------------------------------------------------------------
  T('tr-cdl', 'transportation', 'CDL-A Regional Driver', 1300, 1750, 'week', 'full_time', 'O', 'route', '2+ years', 'High school diploma or GED', ['Tractor-trailer', 'DOT logs', 'Safety record'], 'Regional runs with home most weekends and weekly pay.', ['CDL-A license']),
  T('tr-delivery', 'transportation', 'Delivery Driver', 18, 23, 'hour', 'full_time', 'O', 'route', 'Some experience', 'High school diploma or GED', ['Route planning', 'Package handling', 'Customer service'], 'Deliver packages and freight on a local route in a company vehicle.', ['Valid driver license']),
  T('tr-bus', 'transportation', 'Bus Operator', 22, 30, 'hour', 'full_time', 'O', 'rotating', 'Entry level', 'High school diploma or GED', ['Passenger safety', 'Schedule adherence', 'Customer service'], 'Operate transit buses on fixed routes. Paid CDL training provided.', ['CDL-B (training provided)']),
  T('tr-dispatcher', 'transportation', 'Dispatcher', 20, 26, 'hour', 'full_time', 'OH', 'rotating', '1-2 years', 'High school diploma or GED', ['Route coordination', 'Communication', 'TMS software'], 'Coordinate drivers, loads and customer delivery windows.'),
  T('tr-courier', 'transportation', 'Courier (Independent)', 15, 25, 'hour', 'gig', 'O', 'flex', 'Entry level', 'No formal education required', ['Navigation', 'Time management', 'Reliability'], 'Flexible delivery work using your own vehicle. Estimated hourly earnings.', ['Valid driver license', 'Insured vehicle']),
  T('tr-fleet-attendant', 'transportation', 'Fleet Maintenance Attendant', 17, 22, 'hour', 'full_time', 'O', 'rotating', 'Entry level', 'No formal education required', ['Vehicle cleaning', 'Fluid checks', 'Yard moves'], 'Fuel, clean and stage fleet vehicles for the next shift.'),

  // ---- customer_service ----------------------------------------------------------------------
  T('cs-rep', 'customer_service', 'Customer Support Representative', 16, 20, 'hour', 'full_time', 'R', 'office', 'Entry level', 'High school diploma or GED', ['Phone and chat support', 'Typing', 'Empathy'], 'Answer customer questions and resolve issues by phone and chat.'),
  T('cs-call-center', 'customer_service', 'Call Center Agent', 15, 19, 'hour', 'full_time', 'OH', 'shifts', 'Entry level', 'High school diploma or GED', ['Inbound calls', 'CRM software', 'De-escalation'], 'Handle inbound customer calls in a paid-training call center.'),
  T('cs-claims', 'customer_service', 'Claims Intake Specialist', 18, 22, 'hour', 'full_time', 'ROH', 'office', 'Some experience', 'High school diploma or GED', ['Data entry', 'Active listening', 'Documentation'], 'Take first notice of loss and route claims accurately.'),
  T('cs-tier1', 'customer_service', 'Technical Support Tier 1', 19, 24, 'hour', 'full_time', 'R', 'shifts', 'Some experience', 'High school diploma or GED', ['Troubleshooting', 'Ticketing systems', 'Clear writing'], 'First-line technical support for consumer products.'),
  T('cs-client-services', 'customer_service', 'Client Services Associate', 17, 21, 'hour', 'full_time', 'OH', 'office', 'Entry level', 'High school diploma or GED', ['Email support', 'Account maintenance', 'Organization'], 'Support business clients with orders, billing questions and account changes.'),
  T('cs-chat-pt', 'customer_service', 'Chat Support Agent (Part-Time)', 15, 18, 'hour', 'part_time', 'R', 'flex', 'Entry level', 'High school diploma or GED', ['Typing speed', 'Written communication', 'Multitasking'], 'Part-time, work-from-home chat support with flexible evening shifts.'),

  // ---- office_admin --------------------------------------------------------------------------
  T('ad-assistant', 'office_admin', 'Administrative Assistant', 17, 22, 'hour', 'full_time', 'OH', 'office', 'Some experience', 'High school diploma or GED', ['Microsoft Office', 'Scheduling', 'Communication'], 'Provide day-to-day administrative support to a busy office.'),
  T('ad-data-entry', 'office_admin', 'Data Entry Clerk', 15, 19, 'hour', 'full_time', 'ROH', 'office', 'Entry level', 'High school diploma or GED', ['Typing', 'Accuracy', 'Spreadsheets'], 'Enter and verify records in company systems.'),
  T('ad-reception', 'office_admin', 'Receptionist', 15, 19, 'hour', 'full_time', 'O', 'office', 'Entry level', 'High school diploma or GED', ['Greeting visitors', 'Phones', 'Professionalism'], 'Front-desk reception and general office coordination.'),
  T('ad-ap', 'office_admin', 'Accounts Payable Clerk', 20, 25, 'hour', 'full_time', 'OH', 'office', '1-2 years', 'Associate degree preferred', ['Invoice processing', 'Reconciliation', 'Spreadsheets'], 'Process vendor invoices and payments and reconcile accounts.'),
  T('ad-office-mgr', 'office_admin', 'Office Manager', 48000, 62000, 'year', 'full_time', 'O', 'office', '3+ years', 'Associate degree preferred', ['Vendor management', 'Budgeting', 'Team support'], 'Keep office operations, supplies and vendors running smoothly.'),
  T('ad-payroll', 'office_admin', 'Payroll Specialist', 50000, 65000, 'year', 'full_time', 'OH', 'office', '2+ years', "Bachelor's degree preferred", ['Payroll software', 'Compliance', 'Confidentiality'], 'Process payroll accurately and on time for a growing workforce.'),

  // ---- technology ----------------------------------------------------------------------------
  T('tc-helpdesk', 'technology', 'Help Desk Technician', 20, 27, 'hour', 'full_time', 'ROH', 'office', 'Some experience', 'Associate degree preferred', ['Windows and macOS', 'Ticketing', 'Customer service'], 'Support employees with hardware, software and access issues.'),
  T('tc-web-dev', 'technology', 'Junior Web Developer', 62000, 80000, 'year', 'full_time', 'R', 'office', '1-2 years', "Bachelor's degree preferred", ['JavaScript', 'HTML and CSS', 'Git'], 'Build and maintain features for customer-facing web applications.'),
  T('tc-qa', 'technology', 'QA Tester', 22, 30, 'hour', 'contract', 'R', 'office', 'Some experience', 'High school diploma or GED', ['Test cases', 'Bug reporting', 'Attention to detail'], 'Contract QA testing for web and mobile releases.'),
  T('tc-network', 'technology', 'Network Support Technician', 24, 32, 'hour', 'full_time', 'OH', 'office', '1-2 years', 'Associate degree preferred', ['Cabling', 'Switches and routers', 'Troubleshooting'], 'Install and support office networks and wireless.', ['CompTIA Network+ preferred']),
  T('tc-it-support', 'technology', 'IT Support Specialist', 50000, 65000, 'year', 'full_time', 'ROH', 'office', '2+ years', "Associate degree preferred", ['Active Directory', 'Endpoint management', 'Documentation'], 'Own IT support for a small business, from onboarding to patching.'),
  T('tc-analyst', 'technology', 'Data Analyst', 65000, 85000, 'year', 'full_time', 'R', 'office', '2+ years', "Bachelor's degree preferred", ['SQL', 'Spreadsheets', 'Data visualization'], 'Turn business data into clear reports and recommendations.'),

  // ---- retail --------------------------------------------------------------------------------
  T('rt-sales', 'retail', 'Sales Associate', 15, 18, 'hour', 'full_time', 'O', 'hospitality', 'Entry level', 'No formal education required', ['Customer service', 'Point of sale', 'Product knowledge'], 'Help shoppers find what they need and keep the sales floor ready.'),
  T('rt-stock', 'retail', 'Stock Associate', 15, 18, 'hour', 'full_time', 'O', 'flex', 'Entry level', 'No formal education required', ['Lifting', 'Shelving', 'Inventory'], 'Receive shipments and stock shelves before and during store hours.'),
  T('rt-cashier', 'retail', 'Cashier (Part-Time)', 14, 17, 'hour', 'part_time', 'O', 'flex', 'Entry level', 'No formal education required', ['Cash handling', 'Friendly service', 'Accuracy'], 'Ring up customers quickly and accurately. Part-time, flexible shifts.'),
  T('rt-asm', 'retail', 'Assistant Store Manager', 44000, 56000, 'year', 'full_time', 'O', 'hospitality', '2+ years', 'High school diploma or GED', ['Team leadership', 'Scheduling', 'Merchandising'], 'Help lead store operations, scheduling and customer experience.'),
  T('rt-merch', 'retail', 'Visual Merchandiser', 17, 21, 'hour', 'full_time', 'O', 'day', 'Some experience', 'High school diploma or GED', ['Planograms', 'Creativity', 'Lifting'], 'Set floor plans, displays and seasonal resets.'),
  T('rt-keyholder', 'retail', 'Keyholder', 17, 20, 'hour', 'full_time', 'O', 'hospitality', '1-2 years', 'High school diploma or GED', ['Opening and closing', 'Cash office', 'Coaching'], 'Open and close the store and guide the team on shift.'),
];

// Shared responsibilities per industry (3 are sampled into each description).
export const INDUSTRY_DUTIES = {
  warehouse_logistics: ['Follow all safety procedures and wear required PPE', 'Meet daily accuracy and productivity targets', 'Keep work areas clean and organized', 'Communicate issues to the shift lead promptly', 'Cross-train in multiple areas of the building'],
  manufacturing: ['Follow written work instructions and quality checks', 'Maintain a clean, safe work cell', 'Record production counts accurately', 'Report defects and equipment issues immediately', 'Participate in continuous-improvement activities'],
  construction: ['Work safely on active job sites', 'Keep tools and materials organized and secured', 'Follow direction from the crew lead and superintendent', 'Show up on time and ready to work', 'Help keep the site clean at the end of each day'],
  skilled_trades: ['Complete work orders accurately and on time', 'Follow code and safety requirements', 'Communicate clearly with customers and coworkers', 'Maintain tools, vehicle and parts inventory', 'Document work performed'],
  hospitality: ['Deliver friendly, attentive guest service', 'Keep public areas and work stations spotless', 'Follow brand standards and safety rules', 'Work as part of a team across departments', 'Handle guest requests promptly'],
  food_service: ['Follow food safety and sanitation standards', 'Work quickly and accurately during peak service', 'Keep stations clean, stocked and organized', 'Communicate clearly with the team', 'Follow recipes and portion specifications'],
  healthcare_support: ['Follow infection-control and privacy procedures', 'Treat every patient and coworker with dignity', 'Document care and tasks accurately', 'Respond to changing priorities calmly', 'Work as part of an interdisciplinary team'],
  transportation: ['Follow all safety and DOT regulations', 'Inspect vehicles before and after each shift', 'Communicate delays and issues to dispatch', 'Provide courteous, professional service', 'Keep accurate trip and delivery records'],
  customer_service: ['Resolve customer issues with patience and clarity', 'Document every interaction accurately', 'Meet quality and response-time targets', 'Escalate complex issues to the right team', 'Follow scripts and knowledge-base guidance'],
  office_admin: ['Manage schedules, records and correspondence', 'Handle confidential information with care', 'Support teammates across departments', 'Meet deadlines with accuracy', 'Keep files and systems organized'],
  technology: ['Document work clearly for teammates', 'Communicate status and blockers early', 'Follow security and change-management practices', 'Learn new tools quickly', 'Collaborate in code or ticket reviews'],
  retail: ['Greet and assist customers promptly', 'Keep the sales floor clean and recovered', 'Process transactions accurately', 'Follow loss-prevention and safety procedures', 'Support store goals and promotions'],
};

export const BENEFIT_POOL = [
  'Health insurance', 'Dental insurance', 'Vision insurance', '401(k) with match', 'Paid time off', 'Paid holidays', 'Tuition assistance',
  'Weekly pay', 'Same-day pay option', 'Transit stipend', 'Uniforms provided', 'Shift differential', 'Overtime available', 'Employee discount',
  'Paid on-the-job training', 'Union benefits', 'Life insurance', 'Flexible scheduling', 'Referral bonus', 'Career advancement path',
];

export const QUESTION_POOL = {
  warehouse_logistics: [{ id: 'shift_availability', label: 'Which shifts are you available to work?', type: 'text', required: true }, { id: 'lift_50', label: 'Can you lift 50 lbs repeatedly?', type: 'yes_no', required: true }, { id: 'forklift_cert', label: 'Do you currently hold a forklift certification?', type: 'yes_no', required: false }],
  manufacturing: [{ id: 'shift_availability', label: 'Which shifts are you available to work?', type: 'text', required: true }, { id: 'machine_experience', label: 'Describe any machine or production experience.', type: 'text', required: false }],
  construction: [{ id: 'transport', label: 'Do you have reliable transportation to job sites?', type: 'yes_no', required: true }, { id: 'osha', label: 'Do you have an OSHA 10 or 30 card?', type: 'yes_no', required: false }],
  skilled_trades: [{ id: 'license', label: 'List any trade licenses or certifications you hold.', type: 'text', required: false }, { id: 'transport', label: 'Do you have a valid driver license and reliable transportation?', type: 'yes_no', required: true }],
  hospitality: [{ id: 'weekends', label: 'Are you able to work weekends and holidays?', type: 'yes_no', required: true }],
  food_service: [{ id: 'food_handler', label: 'Do you have a current food handler card?', type: 'yes_no', required: false }, { id: 'shift_availability', label: 'Which shifts are you available to work?', type: 'text', required: true }],
  healthcare_support: [{ id: 'certification', label: 'List any healthcare certifications you hold.', type: 'text', required: false }, { id: 'shift_availability', label: 'Which shifts are you available to work?', type: 'text', required: true }],
  transportation: [{ id: 'license', label: 'What class of driver license do you hold?', type: 'text', required: true }, { id: 'transport', label: 'Are you able to pass a DOT physical and drug screen?', type: 'yes_no', required: false }],
  customer_service: [{ id: 'remote_setup', label: 'Do you have a quiet workspace and reliable internet?', type: 'yes_no', required: false }, { id: 'shift_availability', label: 'Which shifts are you available to work?', type: 'text', required: true }],
  office_admin: [{ id: 'software', label: 'Which office software are you comfortable using?', type: 'text', required: false }],
  technology: [{ id: 'portfolio', label: 'Share a link to a project, portfolio or GitHub (optional).', type: 'text', required: false }],
  retail: [{ id: 'weekends', label: 'Are you available to work weekends and holidays?', type: 'yes_no', required: true }, { id: 'start_date', label: 'When could you start?', type: 'text', required: false }],
};
