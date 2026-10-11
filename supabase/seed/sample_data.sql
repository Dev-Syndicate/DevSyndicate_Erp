-- Sample data for demos: clients, vendors, quotations, invoices, payments, credit notes and expenses across FY 2026-27.
-- Goes through the app's RPCs (as the first Super Admin) so numbers, totals and statuses are real.
-- Run: pnpm dlx supabase db query --linked -f supabase/seed/sample_data.sql   (all or nothing)
-- Remove before go-live with supabase/seed/clear_business_data.sql.
begin;

select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', (
  select p.id from public.profiles p join public.roles r on r.id = p.role_id
  where r.key = 'super_admin' and p.is_active order by p.created_at limit 1))::text, true);

-- ───────────── Clients (with a primary contact) ─────────────
with c (name, address, city, state, pin, gstin, terms, contact, designation, email, phone) as (values
  ('Acme Retail Pvt Ltd', '14 Cathedral Road', 'Chennai', 'Tamil Nadu', '600086', '33AACCA4821K1Z6', 30, 'Priya Raman', 'Head of Digital', 'priya@acmeretail.example', '+91 98400 11223'),
  ('Northwind Logistics', '88 Outer Ring Road, Marathahalli', 'Bengaluru', 'Karnataka', '560037', '29AAFCN7312M1Z2', 30, 'Rahul Menon', 'CTO', 'rahul@northwind.example', '+91 98450 22334'),
  ('Zenith Healthcare', 'Plot 21, HITEC City', 'Hyderabad', 'Telangana', '500081', '36AABCZ5590P1ZK', 30, 'Dr. Anitha Reddy', 'Director', 'anitha@zenithcare.example', '+91 98490 33445'),
  ('Brightpath Education', '5th Floor, Baner Road', 'Pune', 'Maharashtra', '411045', '27AAHCB2045Q1Z9', 15, 'Vikram Kulkarni', 'Founder', 'vikram@brightpath.example', '+91 98220 44556'),
  ('Kaveri Foods', '112 Avinashi Road', 'Coimbatore', 'Tamil Nadu', '641018', '', 30, 'Senthil Kumar', 'Owner', 'senthil@kaverifoods.example', '+91 98430 55667'),
  ('Lotus Fintech', 'BKC, G Block', 'Mumbai', 'Maharashtra', '400051', '27AADCL6634R1ZT', 30, 'Neha Shah', 'Product Manager', 'neha@lotusfintech.example', '+91 98200 66778'),
  ('Nimbus Realty', 'MG Road', 'Kochi', 'Kerala', '682016', '32AAKFN1188S1Z4', 15, 'Arun Nair', 'Marketing Head', 'arun@nimbusrealty.example', '+91 98470 77889'),
  ('Orbit Media', 'Okhla Phase III', 'New Delhi', 'Delhi', '110020', '07AAECO9021T1ZB', 15, 'Karan Malhotra', 'Creative Director', 'karan@orbitmedia.example', '+91 98100 88990'),
  ('Saffron Hotels', 'MI Road', 'Jaipur', 'Rajasthan', '302001', '08AAGCS3307U1Z8', 30, 'Meera Rathore', 'GM Operations', 'meera@saffronhotels.example', '+91 98290 99001'),
  ('Pixel Forge Studios', 'SG Highway', 'Ahmedabad', 'Gujarat', '380054', '', 30, 'Dhruv Patel', 'Partner', 'dhruv@pixelforge.example', '+91 98250 10112'),
  ('Greenleaf Agro', 'KK Nagar', 'Madurai', 'Tamil Nadu', '625020', '', 30, 'Lakshmi Sundaram', 'Managing Director', 'lakshmi@greenleaf.example', '+91 98420 21223'),
  ('Coastal Ventures', 'Beach Road', 'Visakhapatnam', 'Andhra Pradesh', '530003', '37AAICC7745V1Z1', 30, 'Ravi Teja', 'COO', 'ravi@coastalventures.example', '+91 98480 32334')
), ins as (
  insert into public.clients (organization_id, company_name, billing_address, city, state, pin_code, gstin, payment_terms_days)
  select public.current_org_id(), name, address, city, state, pin, gstin, terms from c
  returning id, company_name
)
insert into public.client_contacts (organization_id, client_id, name, designation, email, phone, is_primary)
select public.current_org_id(), ins.id, c.contact, c.designation, c.email, c.phone, true
from ins join c on c.name = ins.company_name;

-- ───────────── Vendors ─────────────
insert into public.vendors (organization_id, name, contact_person, email, gstin, default_expense_category_id)
select public.current_org_id(), v.name, v.contact, v.email, v.gstin,
       (select id from public.expense_categories where name = v.category)
from (values
  ('Amazon Web Services India', '', 'aws-billing@example.com', '29AAKCA9898B1Z3', 'Hosting'),
  ('Hostinger', '', 'billing@hostinger.example', '', 'Hosting'),
  ('GoDaddy India', '', 'billing@godaddy.example', '', 'Domain'),
  ('Google Workspace', '', 'billing@google.example', '', 'Software'),
  ('Figma', '', 'billing@figma.example', '', 'Software'),
  ('WeWork Bengaluru', 'Front desk', 'accounts@wework.example', '29AAACW2214D1ZQ', 'Office'),
  ('Airtel Business', '', 'business@airtel.example', '33AAACB2894G1ZJ', 'Office'),
  ('LinkedIn Ads', '', 'ads@linkedin.example', '', 'Marketing'),
  ('MakeMyTrip', '', 'corporate@makemytrip.example', '07AAFCM1234H1Z5', 'Travel'),
  ('Sharma & Associates (CA)', 'CA Rohit Sharma', 'rohit@sharmaca.example', '33AAGFS5512J1Z7', 'Professional Services')
) as v (name, contact, email, gstin, category);

-- ───────────── Invoices, payments, credit notes ─────────────
do $$
declare
  r record;
  cid uuid;
  inv uuid;
  pay uuid;
  total numeric;
  amt numeric;
  tds numeric;
begin
  for r in select * from (values
    ('Acme Retail Pvt Ltd', date '2026-04-06', 30, '[{"description": "Website redesign", "quantity": 1, "unit_price": 150000}, {"description": "Hosting setup and migration", "quantity": 1, "unit_price": 30000}]', 'full', date '2026-05-02', 'bank_transfer', true),
    ('Northwind Logistics', date '2026-04-20', 15, '[{"description": "Fleet tracking dashboard - phase 1", "quantity": 1, "unit_price": 240000}]', 'full', date '2026-05-08', 'bank_transfer', true),
    ('Zenith Healthcare', date '2026-05-12', 30, '[{"description": "Patient portal maintenance (Apr-Jun)", "quantity": 3, "unit_price": 30000}]', 'full', date '2026-06-05', 'upi', false),
    ('Brightpath Education', date '2026-06-03', 15, '[{"description": "LMS mobile app (Android + iOS)", "quantity": 1, "unit_price": 320000}]', 'half', date '2026-06-25', 'bank_transfer', false),
    ('Kaveri Foods', date '2026-06-18', 30, '[{"description": "Shopify store setup", "quantity": 1, "unit_price": 60000}, {"description": "Product photography edits", "quantity": 50, "unit_price": 300}]', 'full', date '2026-07-10', 'upi', false),
    ('Acme Retail Pvt Ltd', date '2026-07-02', 30, '[{"description": "SEO and performance retainer - Q2", "quantity": 3, "unit_price": 20000}]', 'full', date '2026-07-30', 'bank_transfer', true),
    ('Lotus Fintech', date '2026-07-15', 30, '[{"description": "KYC API integration", "quantity": 1, "unit_price": 210000}]', 'half', date '2026-08-20', 'bank_transfer', false),
    ('Nimbus Realty', date '2026-08-04', 15, '[{"description": "Property listing website", "quantity": 1, "unit_price": 145000}]', 'none', null, null, false),
    ('Greenleaf Agro', date '2026-08-12', 30, '[{"description": "Farm inventory app - discovery", "quantity": 1, "unit_price": 40000}]', 'cancel', null, null, false),
    ('Zenith Healthcare', date '2026-08-22', 30, '[{"description": "Patient portal maintenance (Jul-Sep)", "quantity": 3, "unit_price": 30000}]', 'full', date '2026-09-15', 'upi', false),
    ('Orbit Media', date '2026-09-01', 15, '[{"description": "Video platform UX audit", "quantity": 1, "unit_price": 55000}]', 'none', null, null, false),
    ('Northwind Logistics', date '2026-09-10', 30, '[{"description": "Fleet tracking dashboard - phase 2", "quantity": 1, "unit_price": 160000}]', 'full', date '2026-10-05', 'bank_transfer', true),
    ('Saffron Hotels', date '2026-09-25', 30, '[{"description": "Booking engine integration", "quantity": 1, "unit_price": 125000}]', 'none', null, null, false),
    ('Brightpath Education', date '2026-10-03', 15, '[{"description": "Admin panel enhancements", "quantity": 12, "unit_price": 4000}]', 'pending', date '2026-10-09', 'upi', false),
    ('Pixel Forge Studios', date '2026-10-06', 30, '[{"description": "Brand website - design sprint", "quantity": 1, "unit_price": 85000}]', 'draft', null, null, false)
  ) as t (client, d, terms, items, pay, pay_date, method, with_tds)
  loop
    cid := (select id from public.clients where company_name = r.client);
    inv := public.save_invoice(null, jsonb_build_object('client_id', cid, 'invoice_date', r.d, 'due_date', r.d + r.terms, 'items', r.items::jsonb));
    continue when r.pay = 'draft';
    perform public.invoice_action(inv, 'issue');
    if r.pay = 'cancel' then
      perform public.invoice_action(inv, 'cancel');
      continue;
    end if;
    continue when r.pay = 'none';

    select grand_total into total from public.invoices where id = inv;
    amt := case when r.pay = 'half' then round(total / 2) else total end;
    tds := case when r.with_tds then round(amt * 0.10) else 0 end;  -- 194J: client withholds 10%
    pay := public.save_payment(null, jsonb_build_object('client_id', cid, 'kind', 'receipt', 'amount', amt - tds, 'tds_amount', tds,
             'method', r.method, 'allocations', jsonb_build_array(jsonb_build_object('invoice_id', inv, 'amount', amt))));
    if r.pay <> 'pending' then
      perform public.payment_action(pay, 'confirm', null,
        case r.method when 'upi' then '4' || lpad((abs(hashtext(r.client || r.d)) % 100000000000)::text, 11, '0')
                      else 'UTR' || to_char(r.pay_date, 'YYYYMMDD') || lpad((abs(hashtext(r.client)) % 10000)::text, 4, '0') end,
        r.pay_date);
    end if;
  end loop;

  -- Advance from Saffron Hotels, not yet applied (shows as client credit)
  perform public.payment_action(
    public.save_payment(null, jsonb_build_object('client_id', (select id from public.clients where company_name = 'Saffron Hotels'),
      'amount', 50000, 'method', 'bank_transfer', 'notes', 'Advance for phase 2')),
    'confirm', null, 'UTR20261001SAFF', date '2026-10-01');

  -- Credit notes: reduced scope and a delay discount
  perform public.credit_note_action(public.save_credit_note(null, jsonb_build_object(
    'invoice_id', (select i.id from public.invoices i join public.clients c on c.id = i.client_id
                   where c.company_name = 'Brightpath Education' and i.invoice_date = '2026-06-03'),
    'credit_note_date', '2026-07-01', 'reason', 'Scope reduced: offline mode dropped',
    'items', '[{"description": "Offline mode (removed from scope)", "quantity": 1, "unit_price": 40000}]'::jsonb)), 'issue');
  perform public.credit_note_action(public.save_credit_note(null, jsonb_build_object(
    'invoice_id', (select i.id from public.invoices i join public.clients c on c.id = i.client_id where c.company_name = 'Nimbus Realty'),
    'credit_note_date', '2026-09-01', 'reason', 'Discount for delayed delivery',
    'items', '[{"description": "Delay discount", "quantity": 1, "unit_price": 15000}]'::jsonb)), 'issue');
end $$;

-- ───────────── Quotations ─────────────
do $$
declare
  r record;
  q uuid;
begin
  for r in select * from (values
    ('Northwind Logistics', date '2026-07-01', date '2026-07-16', 'Driver mobile app', '[{"description": "Driver app (Android)", "timeline": "8 weeks", "quantity": 1, "unit_price": 280000}]', 'reject'),
    ('Zenith Healthcare', date '2026-08-10', date '2026-08-25', 'Telemedicine module', '[{"description": "Video consultation module", "timeline": "6 weeks", "quantity": 1, "unit_price": 190000}]', 'reject'),
    ('Pixel Forge Studios', date '2026-09-20', date '2026-10-05', 'Portfolio CMS', '[{"description": "Headless CMS setup", "timeline": "2 weeks", "quantity": 1, "unit_price": 45000}, {"description": "Content migration", "timeline": "1 week", "quantity": 1, "unit_price": 15000}]', 'send'),
    ('Saffron Hotels', date '2026-09-15', date '2026-10-30', 'Booking engine - phase 2', '[{"description": "Channel manager integration", "timeline": "4 weeks", "quantity": 1, "unit_price": 95000}, {"description": "Rate plans and offers", "timeline": "2 weeks", "quantity": 1, "unit_price": 40000}]', 'convert'),
    ('Greenleaf Agro', date '2026-10-01', date '2026-10-31', 'Farm inventory app', '[{"description": "Inventory app (Android)", "timeline": "10 weeks", "quantity": 1, "unit_price": 260000}]', 'send'),
    ('Coastal Ventures', date '2026-10-02', date '2026-11-01', 'Corporate website', '[{"description": "Website design and build", "timeline": "4 weeks", "quantity": 1, "unit_price": 120000}, {"description": "Annual maintenance", "timeline": "12 months", "quantity": 1, "unit_price": 36000}]', 'send'),
    ('Orbit Media', date '2026-10-04', date '2026-11-03', 'Video platform redesign', '[{"description": "UI redesign", "timeline": "5 weeks", "quantity": 1, "unit_price": 175000}]', 'send'),
    ('Lotus Fintech', date '2026-10-06', date '2026-11-05', 'Loan origination workflow', '[{"description": "Workflow engine", "timeline": "6 weeks", "quantity": 1, "unit_price": 230000}, {"description": "Admin dashboard", "timeline": "3 weeks", "quantity": 1, "unit_price": 90000}]', 'accept'),
    ('Acme Retail Pvt Ltd', date '2026-10-07', date '2026-11-06', 'SEO retainer - Q3', '[{"description": "SEO and performance retainer", "timeline": "3 months", "quantity": 3, "unit_price": 20000}]', 'convert'),
    ('Nimbus Realty', date '2026-10-08', null, 'Virtual tour add-on', '[{"description": "360 virtual tours", "timeline": "3 weeks", "quantity": 1, "unit_price": 65000}]', 'draft'),
    ('Kaveri Foods', date '2026-10-09', null, 'WhatsApp ordering', '[{"description": "WhatsApp catalogue and ordering", "timeline": "2 weeks", "quantity": 1, "unit_price": 35000}]', 'draft'),
    ('Brightpath Education', date '2026-10-10', null, 'Parent app', '[{"description": "Parent app (Android + iOS)", "timeline": "8 weeks", "quantity": 1, "unit_price": 210000}]', 'draft')
  ) as t (client, d, valid, title, items, action)
  loop
    q := public.save_quotation(null, jsonb_build_object('client_id', (select id from public.clients where company_name = r.client),
           'quotation_date', r.d, 'valid_until', coalesce(r.valid, r.d + 30), 'title', r.title, 'items', r.items::jsonb));
    continue when r.action = 'draft';
    perform public.quotation_action(q, 'send');
    if r.action in ('accept', 'convert') then perform public.quotation_action(q, 'accept'); end if;
    if r.action = 'reject' then perform public.quotation_action(q, 'reject'); end if;
    if r.action = 'convert' then perform public.invoice_action(public.convert_quotation(q, 'full'), 'issue'); end if;
  end loop;
end $$;

-- ───────────── Expenses ─────────────
do $$
declare
  r record;
begin
  for r in select * from (values
    (date '2026-04-05', 'Hosting', 'Amazon Web Services India', 'AWS - March usage', 18400, 0, 'credit_card'),
    (date '2026-04-10', 'Software', 'Google Workspace', 'Google Workspace - 8 seats', 4320, 0, 'credit_card'),
    (date '2026-05-01', 'Office', 'WeWork Bengaluru', 'Coworking desks - May', 45000, 4500, 'bank_transfer'),
    (date '2026-05-14', 'Domain', 'GoDaddy India', 'devsyndicate.in renewal', 2499, 0, 'credit_card'),
    (date '2026-06-02', 'Software', 'Figma', 'Figma Professional - 2 editors', 3960, 0, 'credit_card'),
    (date '2026-06-20', 'Professional Services', 'Sharma & Associates (CA)', 'Q1 accounting and GST filing', 25000, 2500, 'bank_transfer'),
    (date '2026-07-05', 'Hosting', 'Amazon Web Services India', 'AWS - June usage', 21750, 0, 'credit_card'),
    (date '2026-07-08', 'Marketing', 'LinkedIn Ads', 'Hiring and brand campaign', 15000, 0, 'credit_card'),
    (date '2026-07-22', 'Travel', 'MakeMyTrip', 'Client visit - Bengaluru (Northwind)', 12840, 0, 'upi'),
    (date '2026-08-03', 'Office', 'Airtel Business', 'Office broadband - August', 2360, 0, 'upi'),
    (date '2026-08-18', 'Equipment', null, 'MacBook Air M3 for new developer', 114900, 0, 'credit_card'),
    (date '2026-09-01', 'Office', 'WeWork Bengaluru', 'Coworking desks - September', 45000, 4500, 'bank_transfer'),
    (date '2026-09-02', 'Hosting', 'Hostinger', 'Shared hosting - 12 months', 7188, 0, 'credit_card'),
    (date '2026-10-04', 'Other', null, 'Team lunch - project launch', 3450, 0, 'cash'),
    (date '2026-10-05', 'Hosting', 'Amazon Web Services India', 'AWS - September usage', 24100, 0, 'credit_card')
  ) as t (d, category, vendor, description, amount, tds, method)
  loop
    perform public.save_expense(null, jsonb_build_object('expense_date', r.d,
      'category_id', (select id from public.expense_categories where name = r.category),
      'vendor_id', (select id from public.vendors where name = r.vendor),
      'description', r.description, 'amount', r.amount, 'tds_amount', r.tds, 'method', r.method));
  end loop;
end $$;

commit;
