import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseOcrText } from '../src/services/invoiceOcrService';

describe('invoice OCR service', () => {
  it('parses column-oriented OCR text (like Reliance Fresh) correctly', () => {
    const rawOcrText = `Reliance ffC$K
RELIANCE FRESH
7, Shyam Nagar, Opp. Someshwar Park,
Satellite Road, Ahmedabad - 380015
Ph: 079-40234567
GSTIN: 24AAACR1718EIZ1
Invoice No
Bill No
62. oo
66.00
165.00
22.00
22 .00
24. oo
43.00
43.00
46. oo
125.00
60 .00
30 .00
35.00
109.00
119.00
399 .00
425. oo
135.00
150.00
36 .00
36.00
40 .00
93.00
RF/24-25/018936
B018936
Qty
MRP
(0
Date : 22/05/2026
Time : 06:32 PM
Rate (Z) Amount
No.
1
2
3
4
5
6
7
8
9
10
11
12
Item
Aashirvaad Atta 5kg
Amul Gold Milk IL
India Gate Basmati Rice I kg
Fortune Sunflower Oil IL
Tata Salt Ikg
Sugar 1 kg
Toor Dal Ikg
Maggi 2-Min Noodles 280g
Colgate Strong Teeth 200g
Surf Excel Matic 2kg
Dettol Soap 125g (4+1 )
Bananas (Loose) 1 kg
1
2
1
1
1
1
2
1
1
1
265.00
149.00
249.00
139.00
159.00
119.00
249 .00
1 24.00
139.00
159.00
119.00
109.00
399.00
135.00
1593.00
1500.00
37.50
37.50
1575.00
Subtotal (12 Items)
Discount
Taxable Amount
CGST (2.5%)
SGST (2.5%)
GRAND TOTAL
Amount in Words:
Rupees One Thousand Five Hundred Seventy Five Only
Payment Method : UPI
212233445566
UPI Ref No
Ramesh
Cashier Name
Thank you for shopping with Reliance Fresh!
Visit us again!
RF240522018936`;

    const extracted = parseOcrText(rawOcrText);

    // Assert basics
    assert.equal(extracted.clientName, 'Reliance Fresh');
    assert.equal(extracted.gstNumber, '24AAACR1718EIZ1');
    assert.equal(extracted.invoiceNumber, 'RF/24-25/018936');
    assert.equal(extracted.date, '2026-05-22T00:00:00.000Z');
    assert.equal(extracted.paymentMethod, 'UPI');
    assert.equal(extracted.total, 1575.00);
    assert.equal(extracted.subtotal, 1593.00);
    assert.equal(extracted.taxAmount, 75.00); // CGST 37.50 + SGST 37.50 = 75.00
    assert.equal(extracted.taxType, 'cgst_sgst');

    // Assert line items
    assert.ok(extracted.items.length > 0, 'Items list should not be empty');
    assert.equal(extracted.items[0].name, 'Aashirvaad Atta 5kg');
    assert.equal(extracted.items[0].price, 249.00);
    assert.equal(extracted.items[1].name, 'Amul Gold Milk IL');
    assert.equal(extracted.items[1].price, 62.00);
    assert.equal(extracted.items[11].name, 'Bananas (Loose) 1 kg');
    assert.equal(extracted.items[11].price, 36.00);
  });

  it('parses tabular OCR text with tab/double-space columns correctly', () => {
    const rawTabularText = `Reliance ffC$K
RELIANCE FRESH
7, Shyam Nagar, Opp. Someshwar Park,
Ph: 079-40234567
GSTIN: 24AAACR1718EIZ1
Invoice No : RF/24-25/018936
Date : 22/05/2026

No. Item\tQty\tMRP\tRate\tAmount
1 Aashirvaad Atta 5kg\t1\t265.00\t249.00\t249.00
2 Amul Gold Milk IL\t2\t66.00\t62. oo
3 India Gate Basmati Rice I kg\t1\t149.00\t139.00
4 Fortune Sunflower Oil IL\t165.00\t159.00
5 Tata Salt Ikg\t1\t24. oo\t22 .00
6 Sugar 1 kg\t1\t46. oo\t43.00
7 Toor Dal Ikg\t1\t125.00\t119.00
8 Colgate Strong Teeth 200g\t1\t119.00\t109.00
9 Surf Excel Matic 2kg\t1\t425. oo\t399 .00
10 Dettol Soap 125g (4+1 )\t150.00\t135.00

Subtotal\t1500.00
GRAND TOTAL\t1575.00`;

    const extracted = parseOcrText(rawTabularText);

    assert.equal(extracted.clientName, 'Reliance Fresh');
    assert.equal(extracted.date, '2026-05-22T00:00:00.000Z');
    assert.equal(extracted.items.length, 10);
    assert.equal(extracted.items[0].name, 'Aashirvaad Atta 5kg');
    assert.equal(extracted.items[0].qty, 1);
    assert.equal(extracted.items[0].price, 249.0);
    assert.equal(extracted.items[0].mrp, 265.0);
    
    assert.equal(extracted.items[1].name, 'Amul Gold Milk IL');
    assert.equal(extracted.items[1].qty, 2);
    assert.equal(extracted.items[1].price, 62.0);
    assert.equal(extracted.items[1].mrp, 66.0);

    assert.equal(extracted.items[3].name, 'Fortune Sunflower Oil IL');
    assert.equal(extracted.items[3].qty, 1);
    assert.equal(extracted.items[3].price, 159.0);
    assert.equal(extracted.items[3].mrp, 165.0);

    assert.equal(extracted.items[4].name, 'Tata Salt Ikg');
    assert.equal(extracted.items[4].qty, 1);
    assert.equal(extracted.items[4].price, 22.0);
    assert.equal(extracted.items[4].mrp, 24.0);
  });
});
