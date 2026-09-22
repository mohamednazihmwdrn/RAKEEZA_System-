import QRCode from 'qrcode';

/**
 * Generate a PNG Data URL for a given string
 */
export async function generateQrDataUrl(text: string, size = 320): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: size,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });
  } catch (err) {
    console.error('Failed to generate QR Data URL', err);
    return '';
  }
}

/**
 * Generate an SVG string for a given text
 */
export async function generateQrSvgString(text: string): Promise<string> {
  try {
    return await QRCode.toString(text, {
      type: 'svg',
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });
  } catch (err) {
    console.error('Failed to generate QR SVG', err);
    return '';
  }
}

/**
 * Print a clean, elegant QR Code Display Poster (A4 / A5)
 * Suitable for hanging on showroom counters, store windows, or attaching to invoices
 */
export function printQrPoster(params: {
  companyName: string;
  storeName?: string;
  qrDataUrl: string;
  targetUrl: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  bannerMessage?: string;
}) {
  const printWindow = window.open('', '_blank', 'width=800,height=950');
  if (!printWindow) {
    alert('يرجى السماح بالنوافذ المنبثقة لطباعة ملصق الـ QR Code');
    return;
  }

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>ملصق QR Code - ${params.storeName || params.companyName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    body {
      background: #ffffff;
      color: #0f172a;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .poster-card {
      width: 100%;
      max-width: 620px;
      border: 3px solid #1a237e;
      border-radius: 28px;
      padding: 36px 28px;
      text-align: center;
      box-shadow: 0 10px 25px rgba(0,0,0,0.05);
      position: relative;
      background: #ffffff;
    }
    .badge {
      display: inline-block;
      background: #e8eaf6;
      color: #1a237e;
      font-size: 14px;
      font-weight: 800;
      padding: 6px 18px;
      border-radius: 9999px;
      margin-bottom: 14px;
      letter-spacing: 0.5px;
    }
    .store-title {
      font-size: 28px;
      font-weight: 900;
      color: #1a237e;
      margin-bottom: 6px;
    }
    .subtitle {
      font-size: 15px;
      color: #475569;
      font-weight: 600;
      margin-bottom: 22px;
    }
    .qr-frame {
      display: inline-block;
      background: #ffffff;
      border: 2px dashed #94a3b8;
      border-radius: 24px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
      margin-bottom: 20px;
    }
    .qr-frame img {
      display: block;
      width: 250px;
      height: 250px;
      border-radius: 12px;
    }
    .instructions {
      font-size: 18px;
      font-weight: 800;
      color: #0d47a1;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .sub-instructions {
      font-size: 13px;
      color: #64748b;
      margin-bottom: 22px;
    }
    .url-box {
      background: #f1f5f9;
      padding: 10px 16px;
      border-radius: 12px;
      font-size: 12px;
      color: #334155;
      font-family: monospace;
      word-break: break-all;
      margin-bottom: 24px;
      border: 1px solid #e2e8f0;
    }
    .contact-footer {
      border-top: 2px solid #e2e8f0;
      padding-top: 18px;
      display: flex;
      justify-content: space-around;
      align-items: center;
      font-size: 13px;
      font-weight: 700;
      color: #334155;
      flex-wrap: wrap;
      gap: 10px;
    }
    .contact-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .whatsapp-badge {
      color: #15803d;
    }
    @media print {
      body {
        padding: 0;
      }
      .poster-card {
        border: 2px solid #1a237e;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="poster-card">
    <div class="badge">🛍️ المتجر الإلكتروني والكتالوج الذكي</div>
    <h1 class="store-title">${params.storeName || params.companyName}</h1>
    <p class="subtitle">${params.bannerMessage || 'استعرض أحدث منتجاتنا وأسعارنا واطلب مشترياتك بكل سهولة وسرعة'}</p>

    <div class="qr-frame">
      <img src="${params.qrDataUrl}" alt="رمز QR للكتالوج">
    </div>

    <div class="instructions">
      <span>📱</span> امسح رمز الـ QR بكاميرا الهاتف
    </div>
    <div class="sub-instructions">
      افتح تطبيق الكاميرا، وجّه العدسة نحو الرمز، واضغط على الرابط للانتقال مباشرة لكتالوج المنتجات
    </div>

    <div class="url-box" dir="ltr">
      ${params.targetUrl}
    </div>

    <div class="contact-footer">
      ${params.phone ? `<div class="contact-item"><span>📞 الهاتف:</span> <span dir="ltr">${params.phone}</span></div>` : ''}
      ${params.whatsapp ? `<div class="contact-item whatsapp-badge"><span>💬 واتساب:</span> <span dir="ltr">${params.whatsapp}</span></div>` : ''}
      ${params.address ? `<div class="contact-item"><span>📍 العنوان:</span> <span>${params.address}</span></div>` : ''}
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
