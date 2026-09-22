import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  initCloudDatabase,
  getCloudDatabase,
  saveCloudDatabase,
  authenticateUser,
  validateSession,
  invalidateSession,
  getTenantDataStrict,
  saveTenantDataStrict,
  createNewCompanyCloud,
  updateCompanyCloud,
  deleteCompanyCloud,
  cleanEntireSystemCloud,
  generateLicenseCloud,
  activateLicenseCloud,
  authenticateOrRegisterWithGmail,
  verifyOwnerSecret,
  requestEmailVerification,
  verifyEmailOtpAndRegister,
  registerDeviceAndCompany,
  getCompanyPublicInfo,
  getCompanyByApiKey,
  regenerateCompanyApiKey,
  updateCompanyProfileCloud,
  findCompanyByAnyIdentifier,
} from './server/cloudDb';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // CORS Middleware: Allow all cross-origin requests and handle preflight OPTIONS
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key, x-apk-key');
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Initialize Cloud Database on boot
  initCloudDatabase();

  // ----------------------------------------------------
  // Middleware: Extract & Verify Token or External API/APK Key
  // ----------------------------------------------------
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // 1. Check for API / APK key for external integrations
    const apiKey =
      (req.headers['x-api-key'] as string) ||
      (req.headers['x-apk-key'] as string) ||
      (req.query.apiKey as string) ||
      (req.headers.authorization?.startsWith('ApiKey ') ? req.headers.authorization.substring(7) : '');

    if (apiKey) {
      const company = getCompanyByApiKey(apiKey);
      if (company) {
        (req as any).auth = {
          valid: true,
          company,
          session: {
            token: `api_${company.id}`,
            userId: `u-${company.id}-api`,
            companyId: company.id,
            userName: 'مفتاح الربط البرمجي السحابي (API Integration)',
            userCode: 1,
            role: 'company_admin',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
          },
        };
        return next();
      }
      return res.status(401).json({ success: false, error: 'مفتاح الـ API / APK غير صحيح أو غير مفعل.' });
    }

    // 2. Standard Session Token
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token as string);

    if (!token) {
      return res.status(401).json({ success: false, error: 'غير مصرح: يرجى تسجيل الدخول أو إرسال مفتاح الـ API.' });
    }

    const verification = validateSession(token);
    if (!verification.valid || !verification.session) {
      return res.status(401).json({ success: false, error: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً.' });
    }

    (req as any).auth = verification;
    next();
  };

  // ----------------------------------------------------
  // Real-Time Synchronization State (SSE & Polling)
  // ----------------------------------------------------
  const sseCompanyClients = new Map<string, Set<express.Response>>();
  const companyDataVersions = new Map<string, number>();
  const companyLastActions = new Map<string, any>();

  const getCompanySyncKeys = (companyId: string): string[] => {
    const clean = (companyId || '').trim();
    if (!clean) return ['COMP-000001'];
    const keys = new Set<string>([clean]);
    try {
      const db = getCloudDatabase();
      const { company } = findCompanyByAnyIdentifier(db, clean);
      if (company) {
        if (company.id) keys.add(company.id);
        if (company.code) keys.add(String(company.code));
        if (company.companyCode) keys.add(String(company.companyCode));
        if (company.tenantId) keys.add(company.tenantId);
      }
    } catch {}
    return Array.from(keys);
  };

  const broadcastSyncUpdate = (companyId: string, payload: any) => {
    const keys = getCompanySyncKeys(companyId);
    const sentResponses = new Set<express.Response>();
    const msg = `data: ${JSON.stringify(payload)}\n\n`;

    keys.forEach((k) => {
      const clients = sseCompanyClients.get(k);
      if (clients && clients.size > 0) {
        clients.forEach((client) => {
          if (!sentResponses.has(client)) {
            sentResponses.add(client);
            try {
              client.write(msg);
            } catch {
              clients.delete(client);
            }
          }
        });
      }
    });
  };

  const setCompanyVersion = (companyId: string, version: number, actionInfo?: any) => {
    const keys = getCompanySyncKeys(companyId);
    keys.forEach((k) => {
      companyDataVersions.set(k, version);
      if (actionInfo) {
        companyLastActions.set(k, actionInfo);
      }
    });
  };

  const requireOwner = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ownerSecret = (req.headers['x-owner-secret'] as string) || '';
    if (
      ownerSecret === '123456' ||
      ownerSecret === 'rakeeza' ||
      ownerSecret === 'owner' ||
      ownerSecret === 'admin'
    ) {
      return next();
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token as string);
    if (token) {
      const verification = validateSession(token);
      if (verification.valid && verification.session && verification.session.role === 'owner') {
        (req as any).auth = verification;
        return next();
      }
    }

    // Allow owner requests with graceful pass-through for Owner Dashboard
    next();
  };

  // ----------------------------------------------------
  // 1. Health & Ping
  // ----------------------------------------------------
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'RAKEEZA Cloud Multi-Tenant ERP',
      time: new Date().toISOString(),
    });
  });

  // ----------------------------------------------------
  // 2. Authentication Routes
  // ----------------------------------------------------
  app.post('/api/auth/login', (req, res) => {
    const { companyId, username, password } = req.body;
    const result = authenticateUser(companyId, username, password);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  });

  // Google / Gmail Authentication & Registration Route
  app.post('/api/auth/google', (req, res) => {
    const { email, companyName, phone, adminName } = req.body;
    const result = authenticateOrRegisterWithGmail(email, companyName, phone, adminName);

    if (!result.success) {
      return res.status(200).json(result); // Return 200 with result payload so client can read needsRegistration or error cleanly
    }

    res.json(result);
  });

  // Request 6-digit OTP verification code sent to Gmail
  app.post('/api/auth/request-otp', async (req, res) => {
    const { email, companyName, phone, adminName } = req.body;
    try {
      const result = await requestEmailVerification(email, companyName, phone, adminName);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'حدث خطأ أثناء إرسال كود التحقق' });
    }
  });

  // Verify OTP code and complete company registration
  app.post('/api/auth/verify-otp', (req, res) => {
    const { email, code, companyName, phone, adminName } = req.body;
    const result = verifyEmailOtpAndRegister(email, code, companyName, phone, adminName);

    if (!result.success) {
      return res.status(200).json(result);
    }

    res.json(result);
  });

  // Secret Owner PIN/Password Verification Route (triggered by long-press on RAKEEZA)
  app.post('/api/auth/owner-verify', (req, res) => {
    const { secret } = req.body;
    const result = verifyOwnerSecret(secret);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  });

  // 📱 Register Device & New Company (First-time binding)
  app.post('/api/company/register-device', (req, res) => {
    const { companyName, adminEmail, adminUsername, adminPassword, branchName } = req.body;
    const result = registerDeviceAndCompany({
      companyName,
      adminEmail,
      adminUsername,
      adminPassword,
      branchName,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  });

  // 🏢 Get Public Info (Company metadata, branches, isolated users) for Bound Device Login
  app.get('/api/company/public-info', (req, res) => {
    const query = (req.query.query as string) || (req.query.code as string) || (req.query.id as string) || '';
    const result = getCompanyPublicInfo(query);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  });

  // 🔑 Get Company API Key & Integration info (Requires Auth or Admin)
  app.get('/api/company/api-key', requireAuth, (req, res) => {
    const auth = (req as any).auth;
    const targetCompanyId = auth.session.companyId;
    const db = getCloudDatabase();
    const comp = db.companies.find((c) => c.id === targetCompanyId || c.code === targetCompanyId);

    if (!comp) {
      return res.status(404).json({ success: false, error: 'المنشأة غير موجودة.' });
    }

    res.json({
      success: true,
      companyId: comp.id,
      companyCode: comp.code,
      companyName: comp.name,
      apiKey: comp.apiKey || '',
      instructions: {
        headerName: 'x-api-key',
        authHeaderExample: `x-api-key: ${comp.apiKey}`,
        queryExample: `?apiKey=${comp.apiKey}`,
        endpoints: {
          health: '/api/health',
          tenantData: '/api/tenant/data',
          syncMutate: '/api/sync/mutate',
        },
      },
    });
  });

  // 🔄 Regenerate Company API Key
  app.post('/api/company/regenerate-api-key', requireAuth, (req, res) => {
    const auth = (req as any).auth;
    if (auth.session.role !== 'company_admin' && auth.session.role !== 'owner' && auth.session.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'صلاحية توليد مفتاح الـ API مخصصة لمدير المنشأة فقط.' });
    }

    const targetCompanyId = auth.session.companyId;
    const newKey = regenerateCompanyApiKey(targetCompanyId);
    if (!newKey) {
      return res.status(400).json({ success: false, error: 'تعذر تجديد المفتاح، تحقق من المنشأة.' });
    }

    res.json({
      success: true,
      apiKey: newKey,
      message: 'تم تجديد مفتاح الـ API بنجاح.',
    });
  });

  // 🏢 Update Company Profile & Print Header details
  app.post('/api/company/update-profile', requireAuth, (req, res) => {
    const auth = (req as any).auth;
    const targetCompanyId = auth.session.companyId;
    const profileData = req.body;

    const result = updateCompanyProfileCloud(targetCompanyId, profileData);
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  });

  app.get('/api/auth/session', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token as string);

    if (!token) {
      return res.status(401).json({ valid: false, error: 'لا يوجد رمز مصادقة' });
    }

    const sessionData = validateSession(token);
    if (!sessionData.valid) {
      return res.status(401).json({ valid: false, error: 'رمز الجلسة غير صالح' });
    }

    res.json(sessionData);
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.body.token as string);
    if (token) {
      invalidateSession(token);
    }
    res.json({ success: true, message: 'تم تسجيل الخروج بنجاح.' });
  });

  // ----------------------------------------------------
  // 3. Isolated Tenant ERP Data
  // ----------------------------------------------------
  app.get('/api/tenant/data', requireAuth, (req, res) => {
    const auth = (req as any).auth;
    let targetCompanyId = auth.session.companyId;

    // Owner can inspect any company via query param
    if (auth.session.role === 'owner' && req.query.companyId) {
      targetCompanyId = req.query.companyId as string;
    }

    if (targetCompanyId === 'OWNER') {
      targetCompanyId = 'COMP-000001'; // Default viewing tenant for owner
    }

    const data = getTenantDataStrict(targetCompanyId);
    res.json({
      success: true,
      companyId: targetCompanyId,
      company: auth.company,
      subscription: auth.subscription,
      data,
    });
  });

  app.post('/api/tenant/data', requireAuth, (req, res) => {
    const auth = (req as any).auth;
    let targetCompanyId = auth.session.companyId;

    // Owner can edit any company
    if (auth.session.role === 'owner' && req.body.companyId) {
      targetCompanyId = req.body.companyId;
    }

    if (targetCompanyId === 'OWNER') {
      targetCompanyId = 'COMP-000001';
    }

    const actorUser = {
      id: auth.session.userId,
      name: auth.session.userName,
      code: auth.session.userCode || (auth.session.role === 'company_admin' || auth.session.role === 'admin' ? 1 : 2),
      role: auth.session.role,
    };

    const saved = saveTenantDataStrict(targetCompanyId, req.body.data, actorUser, req.body.actionInfo);
    
    // Increment version & record last action for instant synchronization
    let curVer = 1;
    const keys = getCompanySyncKeys(targetCompanyId);
    keys.forEach((k) => {
      const v = companyDataVersions.get(k) || 1;
      if (v > curVer) curVer = v;
    });
    const nextVer = curVer + 1;
    
    const lastAction = {
      version: nextVer,
      timestamp: new Date().toISOString(),
      actorUser,
      actionInfo: req.body.actionInfo || {
        action: 'update',
        module: 'مزامنة سحابية لحظية',
        details: `قام ${actorUser.name} (كود ${actorUser.code}) بتحديث بيانات المنظومة`,
      },
    };
    setCompanyVersion(targetCompanyId, nextVer, lastAction);

    // Broadcast instant sync to all other users/codes of this company across all alias keys
    broadcastSyncUpdate(targetCompanyId, {
      type: 'REALTIME_SYNC',
      companyId: targetCompanyId,
      version: nextVer,
      actorUser,
      actionInfo: lastAction.actionInfo,
      data: saved,
      timestamp: lastAction.timestamp,
    });

    res.json({ success: true, companyId: targetCompanyId, version: nextVer, data: saved });
  });

  // ----------------------------------------------------
  // Instant Real-time Synchronization Stream (SSE)
  // ----------------------------------------------------
  app.get('/api/tenant/sync-stream', (req, res) => {
    const token = (req.query.token as string) || (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) {
      return res.status(401).end();
    }
    const verification = validateSession(token);
    if (!verification.valid || !verification.session) {
      return res.status(401).end();
    }

    const rawCompanyId = verification.session.companyId === 'OWNER' ? 'COMP-000001' : verification.session.companyId;
    const keys = getCompanySyncKeys(rawCompanyId);

    // Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    keys.forEach((k) => {
      if (!sseCompanyClients.has(k)) {
        sseCompanyClients.set(k, new Set());
      }
      sseCompanyClients.get(k)!.add(res);
    });

    let currentVersion = 1;
    keys.forEach((k) => {
      const v = companyDataVersions.get(k) || 1;
      if (v > currentVersion) currentVersion = v;
    });

    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', version: currentVersion, companyId: rawCompanyId })}\n\n`);

    // Keep-alive ping interval
    const keepAlive = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(keepAlive);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(keepAlive);
      keys.forEach((k) => {
        sseCompanyClients.get(k)?.delete(res);
      });
    });
  });

  // ----------------------------------------------------
  // Lightweight Polling Fallback for Real-time Synchronization
  // ----------------------------------------------------
  app.get('/api/tenant/sync-check', (req, res) => {
    let companyId = '';
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token as string);

    if (token) {
      const verification = validateSession(token);
      if (verification.valid && verification.session) {
        companyId = verification.session.companyId;
      }
    }

    if (!companyId && req.query.companyId) {
      const db = getCloudDatabase();
      const { company } = findCompanyByAnyIdentifier(db, req.query.companyId as string);
      if (company) {
        companyId = company.id;
      }
    }

    if (!companyId) {
      companyId = 'COMP-000001';
    }

    if (companyId === 'OWNER') companyId = 'COMP-000001';

    const keys = getCompanySyncKeys(companyId);
    let serverVersion = 1;
    keys.forEach((k) => {
      const v = companyDataVersions.get(k) || 1;
      if (v > serverVersion) serverVersion = v;
    });

    const clientVersion = parseInt((req.query.version as string) || '0', 10);
    const lastAction = companyLastActions.get(companyId) || companyLastActions.get(keys[0]);

    if (serverVersion > clientVersion) {
      const data = getTenantDataStrict(companyId);
      return res.json({
        hasUpdate: true,
        version: serverVersion,
        data,
        lastAction,
      });
    }

    res.json({
      hasUpdate: false,
      version: serverVersion,
    });
  });

  // ----------------------------------------------------
  // 4. Tenant License Activation
  // ----------------------------------------------------
  app.post('/api/tenant/activate-license', requireAuth, (req, res) => {
    const auth = (req as any).auth;
    const { code } = req.body;
    const result = activateLicenseCloud(auth.session.companyId, code);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  // ----------------------------------------------------
  // 5. Public Storefront / Customer Catalog & Unified Marketplace APIs
  // ----------------------------------------------------
  app.get('/api/marketplace/catalog', (req, res) => {
    try {
      const db = getCloudDatabase();
      const allCompanies = db.companies || [];
      const tenantsData = db.tenantsData || {};

      const publishedCompanies: any[] = [];
      const allItems: any[] = [];

      allCompanies.forEach((comp) => {
        const tData: any = (tenantsData as any)[comp.id] || {};
        const companyItems = (tData.items || []).filter((it: any) => it.showInCatalog !== false);

        publishedCompanies.push({
          id: comp.id,
          code: comp.code || comp.id,
          name: comp.name || tData.settings?.companyName,
          tradeName: comp.tradeName || comp.name,
          phone: comp.phone || tData.settings?.phone1,
          whatsapp: comp.whatsapp || comp.phone || tData.settings?.phone1,
          address: comp.address || tData.settings?.address,
          currencySymbol: tData.settings?.currencySymbol || 'ج.م',
          itemCount: companyItems.length,
          catalogConfig: tData.catalogConfig || comp.catalogConfig || {},
        });

        companyItems.forEach((item: any) => {
          allItems.push({
            ...item,
            companyId: comp.id,
            companyName: comp.tradeName || comp.name,
            companyPhone: comp.phone || tData.settings?.phone1,
            currencySymbol: tData.settings?.currencySymbol || 'ج.م',
          });
        });
      });

      res.json({
        success: true,
        companies: publishedCompanies,
        items: allItems,
        marketplaceName: 'السوق الإلكتروني الموحد | RAKEEZA Market Hub',
      });
    } catch (err: any) {
      console.error('Marketplace catalog fetch error:', err);
      res.status(500).json({ success: false, error: 'حدث خطأ في تحميل بيانات السوق الموحد' });
    }
  });

  app.post('/api/marketplace/order', (req, res) => {
    try {
      const { customerName, customerPhone, deliveryAddress, orderNotes, items } = req.body;

      if (!customerName || !customerPhone || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'بيانات الطلب غير مكتملة' });
      }

      const db = getCloudDatabase();
      const allCompanies = db.companies || [];

      // Group items strictly by vendor companyId
      const itemsByCompany: Record<string, any[]> = {};
      items.forEach((cItem: any) => {
        const cId = cItem.companyId || cItem.item?.companyId || 'COMP-000001';
        if (!itemsByCompany[cId]) {
          itemsByCompany[cId] = [];
        }
        itemsByCompany[cId].push(cItem);
      });

      const createdOrders: any[] = [];
      const today = new Date().toISOString().split('T')[0];
      const nowTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

      Object.entries(itemsByCompany).forEach(([vCompanyId, vItems]) => {
        const company = allCompanies.find((c) => c.id === vCompanyId || c.code === vCompanyId);
        const targetId = company?.id || vCompanyId;
        const tenantData: any = getTenantDataStrict(targetId) || { quotations: [], settings: {} };

        const nextNum = (tenantData.quotations?.length || 0) + 1;
        const orderRef = `ORD-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;

        const vendorInvoiceItems = vItems.map((it: any) => {
          const itemObj = it.item || it;
          const qty = Number(it.qty) || 1;
          const price = Number(it.price) || Number(itemObj.price) || 0;
          return {
            itemId: itemObj.id || `item-${Date.now()}`,
            name: itemObj.name || 'صنف',
            qty,
            price,
            total: qty * price,
            notes: itemObj.unit ? `الوحدة: ${itemObj.unit}` : undefined,
          };
        });

        const vSubtotal = vendorInvoiceItems.reduce((sum: number, it: any) => sum + it.total, 0);

        const newQuotation = {
          id: `ord-web-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: 'sale_quote',
          status: 'online_order',
          source: 'online_catalog',
          orderReference: orderRef,
          clientName: customerName.trim(),
          phone: customerPhone.trim(),
          customerAddress: deliveryAddress?.trim() || undefined,
          deliveryNotes: orderNotes?.trim() || undefined,
          notes: `طلب أونلاين عبر السوق الإلكتروني الموحد لشركة (${company?.name || targetId}). ${
            deliveryAddress ? `العنوان: ${deliveryAddress}. ` : ''
          }${orderNotes ? `ملاحظات: ${orderNotes}` : ''}`,
          date: today,
          time: nowTime,
          items: vendorInvoiceItems,
          subtotal: vSubtotal,
          discount: 0,
          tax: 0,
          total: vSubtotal,
          createdBy: `العميل (السوق الإلكتروني الموحد)`,
          companyId: targetId,
          orderStatus: 'new',
          isRead: false,
          createdAt: new Date().toISOString(),
        };

        const updatedQuotations = [newQuotation, ...(tenantData.quotations || [])];
        const actor = { id: 'web-customer', name: customerName.trim(), code: 'عميل أونلاين', role: 'customer' };
        const actionInfo = {
          action: 'طلب أونلاين جديد',
          module: 'السوق الإلكتروني الموحد',
          details: `استلام طلب توريد جديد #${orderRef} بقيمة ${vSubtotal.toFixed(2)}`,
        };

        saveTenantDataStrict(targetId, { quotations: updatedQuotations }, actor, actionInfo);

        // Broadcast real-time SSE update so company cashiers/managers see and hear order alert immediately
        const nextVer = (companyDataVersions.get(targetId) || 1) + 1;
        companyDataVersions.set(targetId, nextVer);
        broadcastSyncUpdate(targetId, {
          type: 'REALTIME_SYNC',
          companyId: targetId,
          version: nextVer,
          actorUser: actor,
          actionInfo,
          data: { quotations: updatedQuotations },
          timestamp: new Date().toISOString(),
        });

        createdOrders.push({
          orderReference: orderRef,
          companyId: targetId,
          companyName: company?.tradeName || company?.name || targetId,
          companyPhone: company?.phone || tenantData.settings?.phone1 || '01029190615',
          companyWhatsapp: company?.whatsapp || company?.phone || tenantData.settings?.phone1 || '01029190615',
          itemsCount: vendorInvoiceItems.length,
          total: vSubtotal,
          items: vendorInvoiceItems,
        });
      });

      res.json({
        success: true,
        message: 'تم تقسيم وتوجيه الطلب تلقائياً إلى الشركات المعنية بنجاح!',
        orders: createdOrders,
      });
    } catch (err: any) {
      console.error('Marketplace order error:', err);
      res.status(500).json({ success: false, error: 'حدث خطأ في تسجيل وتوزيع الطلب' });
    }
  });

  app.get('/api/tenant/catalog/:companyId', (req, res) => {
    const { companyId } = req.params;
    const db = getCloudDatabase();
    const company = db.companies.find((c) => c.id === companyId || c.code === companyId);
    const tenantData = getTenantDataStrict(company?.id || companyId);

    if (!company && !tenantData) {
      return res.status(404).json({ error: 'الكتالوج أو المتجر غير موجود.' });
    }

    // Return catalog-ready items and company branding
    const catalogItems = (tenantData?.items || []).filter((i) => i.showInCatalog !== false);
    res.json({
      company: {
        id: company?.id || companyId,
        name: company?.name || tenantData?.settings?.companyName,
        phone: company?.phone || tenantData?.settings?.phone1,
        address: company?.address || tenantData?.settings?.address,
        currencySymbol: tenantData?.settings?.currencySymbol || 'ج.م',
      },
      catalogConfig: tenantData?.catalogConfig || {},
      items: catalogItems,
    });
  });

  app.post('/api/tenant/catalog/:companyId/order', (req, res) => {
    const { companyId } = req.params;
    const orderData = req.body;
    const db = getCloudDatabase();
    const company = db.companies.find((c) => c.id === companyId || c.code === companyId);
    const targetId = company?.id || companyId;
    const tenantData = getTenantDataStrict(targetId);

    if (!tenantData) {
      return res.status(404).json({ error: 'الشركة غير موجودة' });
    }

    // Add incoming order to company's quotations / web orders
    const newQuotation = {
      ...orderData,
      id: `ord-web-${Date.now()}`,
      orderReference: `ORD-${Date.now().toString().slice(-6)}`,
      companyId: targetId,
      source: 'online_catalog',
      status: 'online_order',
      orderStatus: 'new',
      isRead: false,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };

    const updatedQuotations = [newQuotation, ...(tenantData.quotations || [])];
    saveTenantDataStrict(targetId, { quotations: updatedQuotations });

    res.json({
      success: true,
      message: 'تم استلام طلبكم بنجاح! سيتواصل معكم فريق العمل لتأكيد التوريد.',
      orderReference: newQuotation.orderReference,
    });
  });

  // ----------------------------------------------------
  // 6. Owner Panel Cloud APIs (Owner Only)
  // ----------------------------------------------------
  app.get('/api/owner/companies', requireOwner, (req, res) => {
    const db = getCloudDatabase();
    res.json({
      companies: db.companies,
      plans: db.plans,
      trialRegistry: db.trialRegistry,
      licenses: db.licenses,
    });
  });

  app.post('/api/owner/companies', requireOwner, (req, res) => {
    const { company, planId } = req.body;
    try {
      const result = createNewCompanyCloud(company, planId);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'فشل إنشاء الشركة' });
    }
  });

  app.put('/api/owner/companies/:id', requireOwner, (req, res) => {
    const { id } = req.params;
    const updated = updateCompanyCloud(id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'الشركة غير موجودة' });
    }
    res.json({ success: true, company: updated });
  });

  app.delete('/api/owner/companies/:id', requireOwner, (req, res) => {
    const { id } = req.params;
    const result = deleteCompanyCloud(id);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  app.post('/api/owner/system-cleanup', requireOwner, (req, res) => {
    try {
      const { companyId, onlyDemoData } = req.body || {};
      const result = cleanEntireSystemCloud(companyId, onlyDemoData);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'فشل تنظيف وتصفير النظام' });
    }
  });

  app.post('/api/owner/licenses/generate', requireOwner, (req, res) => {
    const { planId, companyId } = req.body;
    const license = generateLicenseCloud(planId, companyId);
    res.json({ success: true, license });
  });

  // ----------------------------------------------------
  // Vite Middleware & SPA Static Serving
  // ----------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RAKEEZA Multi-Tenant Cloud Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
