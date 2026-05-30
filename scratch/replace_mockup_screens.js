const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../website/index.html');
let html = fs.readFileSync(filePath, 'utf8');

// Find the showcase-phone-screen container boundary
const startTarget = '<div class="showcase-phone-screen">';
const endTarget = '</div>\n          </div>\n        </div>\n\n        <!-- Step Description Panels (Sticky Scroll Content) -->';

const startIndex = html.indexOf(startTarget);
const endIndex = html.indexOf(endTarget);

if (startIndex !== -1 && endIndex !== -1) {
  console.log('Found showcase screen containers boundaries!');
  
  const before = html.substring(0, startIndex + startTarget.length);
  const after = html.substring(endIndex);
  
  const cleanScreensHtml = `
              <!-- Screen 1: Home Dashboard UI -->
              <div class="mock-screen-content active" id="screen-dashboard">
                <div class="mock-app-screen">
                  <!-- Status Bar -->
                  <div class="screen-status-bar">
                    <span class="status-time">9:41</span>
                    <div class="status-icons">
                      <i data-lucide="wifi" style="width: 12px; height: 12px;"></i>
                      <i data-lucide="battery" style="width: 12px; height: 12px;"></i>
                    </div>
                  </div>
                  
                  <!-- Scrollable Body -->
                  <div class="screen-body">
                    <!-- Header with Orange BG -->
                    <div class="home-header-bg">
                      <div class="screen-header-custom">
                        <div class="screen-header-left">
                          <div class="home-logo-circle">
                            <img src="assets/SubTrack_App_Icon.png" alt="S" style="width: 16px; height: 16px; border-radius: 4px;" />
                          </div>
                          <div class="screen-header-text">
                            <h2 class="screen-header-title">Home</h2>
                            <span class="screen-header-subtitle">Hello, Mavrix • Financial overview</span>
                          </div>
                        </div>
                        <div class="screen-header-right">
                          <i data-lucide="settings" style="width: 16px; height: 16px;"></i>
                          <i data-lucide="bell" style="width: 16px; height: 16px;"></i>
                        </div>
                      </div>
                      
                      <!-- Overview Panel -->
                      <div class="home-overview-sec">
                        <span class="overview-lbl">TOTAL OVERVIEW</span>
                        <h1 class="overview-val">₹985</h1>
                        <div class="overview-sub-row">
                          <span class="balance-pill"><i data-lucide="trending-up" style="width: 10px; height: 10px; margin-right: 2px;"></i> Live balance</span>
                          <span class="balance-time">Current month</span>
                        </div>
                      </div>
                    </div>
                    
                    <!-- 2x2 Info Grid -->
                    <div class="home-grid-row">
                      <div class="home-grid-card">
                        <span class="grid-card-lbl">TOTAL SPEND</span>
                        <div class="grid-card-bottom">
                          <span class="grid-card-val">₹985</span>
                          <i data-lucide="trending-up" style="width: 14px; height: 14px; color: #EF4444;"></i>
                        </div>
                      </div>
                      <div class="home-grid-card">
                        <span class="grid-card-lbl">ACTIVE SUBS</span>
                        <div class="grid-card-bottom">
                          <span class="grid-card-val">2</span>
                          <i data-lucide="play-circle" style="width: 14px; height: 14px; color: #22C55E;"></i>
                        </div>
                      </div>
                      <div class="home-grid-card">
                        <span class="grid-card-lbl">PENDING INV</span>
                        <div class="grid-card-bottom">
                          <span class="grid-card-val">₹377</span>
                          <i data-lucide="file-text" style="width: 14px; height: 14px; color: #F59E0B;"></i>
                        </div>
                      </div>
                      <div class="home-grid-card">
                        <span class="grid-card-lbl">EXPENSES</span>
                        <div class="grid-card-bottom">
                          <span class="grid-card-val">₹0</span>
                          <i data-lucide="wallet" style="width: 14px; height: 14px; color: #64748B;"></i>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Recent Activity -->
                    <div class="home-activity-sec">
                      <div class="activity-header">
                        <div class="activity-header-left">
                          <span class="activity-title">Activity</span>
                          <span class="activity-subtitle">Everything active in one place</span>
                        </div>
                        <a href="#" class="activity-link">View all</a>
                      </div>
                      
                      <div class="activity-list">
                        <div class="app-list-item">
                          <div class="app-item-info">
                            <div class="app-item-icon-circle" style="background: #1DB954;">
                              <i data-lucide="music" style="width: 12px; height: 12px;"></i>
                            </div>
                            <div class="app-item-text">
                              <span class="app-item-name">Spotify</span>
                              <span class="app-item-sub">Renewal</span>
                            </div>
                          </div>
                          <span class="app-item-price">₹199</span>
                        </div>
                        
                        <div class="app-list-item">
                          <div class="app-item-info">
                            <div class="app-item-icon-circle" style="background: #E50914;">
                              <i data-lucide="film" style="width: 12px; height: 12px;"></i>
                            </div>
                            <div class="app-item-text">
                              <span class="app-item-name">Netflix</span>
                              <span class="app-item-sub">Renewal</span>
                            </div>
                          </div>
                          <span class="app-item-price">₹409</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <!-- Bottom Home Indicator -->
                  <div class="screen-home-indicator"></div>
                </div>
              </div>
              
              <!-- Screen 2: Subscriptions UI -->
              <div class="mock-screen-content" id="screen-ai">
                <div class="mock-app-screen">
                  <!-- Status Bar -->
                  <div class="screen-status-bar">
                    <span class="status-time">9:41</span>
                    <div class="status-icons">
                      <i data-lucide="wifi" style="width: 12px; height: 12px;"></i>
                      <i data-lucide="battery" style="width: 12px; height: 12px;"></i>
                    </div>
                  </div>
                  
                  <!-- Scrollable Body -->
                  <div class="screen-body">
                    <!-- Header -->
                    <div class="screen-header-custom">
                      <h2 class="screen-header-title">Subscriptions</h2>
                      <button class="btn-circle-orange">+</button>
                    </div>
                    
                    <div class="subs-report-card">
                      <div class="report-title-group">
                        <span class="report-title">Subscription report</span>
                        <span class="report-desc">Clean monthly overview</span>
                      </div>
                      <i data-lucide="refresh-cw" class="report-refresh-btn" style="width: 14px; height: 14px;"></i>
                    </div>
                    
                    <!-- Orange monthly total card -->
                    <div class="subs-orange-card">
                      <span class="orange-card-lbl">MONTHLY TOTAL</span>
                      <div class="orange-card-middle">
                        <span class="orange-card-val">₹608</span>
                        <span class="orange-card-badge">2 active</span>
                      </div>
                    </div>
                    
                    <!-- Three mini-stat cards -->
                    <div class="subs-stats-row">
                      <div class="subs-stat-card-mini">
                        <i data-lucide="calendar" style="width: 12px; height: 12px; color: #475569;"></i>
                        <span class="stat-mini-lbl">YEARLY RUN</span>
                        <span class="stat-mini-val">₹7,296</span>
                      </div>
                      <div class="subs-stat-card-mini">
                        <i data-lucide="calculator" style="width: 12px; height: 12px; color: #475569;"></i>
                        <span class="stat-mini-lbl">AVERAGE</span>
                        <span class="stat-mini-val">₹304</span>
                      </div>
                      <div class="subs-stat-card-mini">
                        <i data-lucide="clock" style="width: 12px; height: 12px; color: #475569;"></i>
                        <span class="stat-mini-lbl">MIX</span>
                        <span class="stat-mini-val">2M / 0Y</span>
                      </div>
                    </div>
                    
                    <!-- Subscription listings -->
                    <div class="activity-list" style="margin-top: 16px;">
                      <div class="app-list-item" style="border-left: 4px solid #1DB954; border-radius: 4px 12px 12px 4px; padding-left: 10px;">
                        <div class="app-item-info">
                          <div class="app-item-icon-circle" style="background: #1DB954;">
                            <i data-lucide="music" style="width: 12px; height: 12px;"></i>
                          </div>
                          <div class="app-item-text">
                            <span class="app-item-name">Spotify</span>
                            <span class="app-item-sub">Premium • 1 month</span>
                          </div>
                        </div>
                        <span class="app-item-price">₹199</span>
                      </div>
                      
                      <div class="app-list-item" style="border-left: 4px solid #E50914; border-radius: 4px 12px 12px 4px; padding-left: 10px;">
                        <div class="app-item-info">
                          <div class="app-item-icon-circle" style="background: #E50914;">
                            <i data-lucide="film" style="width: 12px; height: 12px;"></i>
                          </div>
                          <div class="app-item-text">
                            <span class="app-item-name">Netflix</span>
                            <span class="app-item-sub">Premium • 1 month</span>
                          </div>
                        </div>
                        <span class="app-item-price">₹409</span>
                      </div>
                    </div>
                  </div>
                  <!-- Bottom Home Indicator -->
                  <div class="screen-home-indicator"></div>
                </div>
              </div>
              
              <!-- Screen 3: Expenses UI with Alarm Overlay -->
              <div class="mock-screen-content" id="screen-alarm">
                <div class="mock-app-screen">
                  <!-- Status Bar -->
                  <div class="screen-status-bar">
                    <span class="status-time">9:41</span>
                    <div class="status-icons">
                      <i data-lucide="wifi" style="width: 12px; height: 12px;"></i>
                      <i data-lucide="battery" style="width: 12px; height: 12px;"></i>
                    </div>
                  </div>
                  
                  <!-- Scrollable Body (Background) -->
                  <div class="screen-body" style="filter: blur(4px); opacity: 0.6; pointer-events: none;">
                    <div class="screen-header-custom">
                      <h2 class="screen-header-title">Expenses</h2>
                      <button class="btn-circle-orange">+</button>
                    </div>
                    
                    <!-- Search & Filter Bar -->
                    <div style="background: #FFF; border-radius: 12px; padding: 10px 14px; margin-bottom: 12px; border: 1px solid #E2E8F0; display: flex; align-items: center; gap: 8px;">
                      <i data-lucide="search" style="width: 14px; height: 14px; color: #94A3B8;"></i>
                      <span style="color: #94A3B8; font-size: 11px;">Search expenses...</span>
                    </div>
                    
                    <div class="expense-filter-row">
                      <span class="filter-pill active">This month</span>
                      <span class="filter-pill">Last month</span>
                      <span class="filter-pill">Custom</span>
                    </div>
                    
                    <!-- Empty State -->
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 10px; text-align: center; gap: 10px;">
                      <div style="width: 48px; height: 48px; border-radius: 50%; background: #F1F5F9; display: flex; align-items: center; justify-content: center; color: #94A3B8;">
                        <i data-lucide="cash-slash" style="width: 24px; height: 24px;"></i>
                      </div>
                      <div>
                        <h4 style="font-size: 13px; font-weight: 700; color: #475569; margin: 0;">No expenses found</h4>
                        <p style="font-size: 10px; color: #94A3B8; margin: 4px 0 0 0;">You haven't added any expenses yet.</p>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Alarm Intent Overlay Panel -->
                  <div class="alarm-overlay-container">
                    <div class="alarm-card-ui">
                      <div class="alarm-bell-icon">
                        <i data-lucide="bell" style="width: 24px; height: 24px; color: #FFF;"></i>
                      </div>
                      <span class="alarm-type-lbl">RENEWAL ALARM</span>
                      <h2 class="alarm-sub-title">Netflix Premium</h2>
                      <h1 class="alarm-amount-val">₹409</h1>
                      <span class="alarm-meta-text">Due today • Bypassing DND</span>
                      
                      <div class="alarm-actions-row">
                        <button class="btn-alarm-dismiss">Dismiss</button>
                        <button class="btn-alarm-snooze">Snooze (30m)</button>
                      </div>
                    </div>
                  </div>
                  <!-- Bottom Home Indicator -->
                  <div class="screen-home-indicator"></div>
                </div>
              </div>
              
              <!-- Screen 4: Invoices UI -->
              <div class="mock-screen-content" id="screen-analytics">
                <div class="mock-app-screen">
                  <!-- Status Bar -->
                  <div class="screen-status-bar">
                    <span class="status-time">9:41</span>
                    <div class="status-icons">
                      <i data-lucide="wifi" style="width: 12px; height: 12px;"></i>
                      <i data-lucide="battery" style="width: 12px; height: 12px;"></i>
                    </div>
                  </div>
                  
                  <!-- Scrollable Body -->
                  <div class="screen-body">
                    <div class="screen-header-custom" style="margin-bottom: 8px;">
                      <h2 class="screen-header-title">Invoices</h2>
                      <div style="display: flex; gap: 8px; align-items: center;">
                        <i data-lucide="camera" style="width: 16px; height: 16px; color: #475569; cursor: pointer;"></i>
                        <button class="btn-circle-orange">+</button>
                      </div>
                    </div>
                    
                    <!-- Total Invoiced Panel -->
                    <div style="margin-bottom: 12px;">
                      <h1 class="invoice-big-val">₹377</h1>
                      <span class="invoice-lbl">TOTAL INVOICED</span>
                    </div>
                    
                    <!-- Spline Graph Viewport -->
                    <div class="invoice-chart-container">
                      <svg class="invoice-chart-svg" viewBox="0 0 240 60">
                        <defs>
                          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#F97316" stop-opacity="0.3"></stop>
                            <stop offset="100%" stop-color="#F97316" stop-opacity="0.0"></stop>
                          </linearGradient>
                        </defs>
                        <!-- Area -->
                        <path d="M 0 50 Q 40 40 80 50 T 160 30 T 240 20 L 240 60 L 0 60 Z" fill="url(#chartGrad)"></path>
                        <!-- Spline Line -->
                        <path d="M 0 50 Q 40 40 80 50 T 160 30 T 240 20" fill="none" stroke="#F97316" stroke-width="2.5" stroke-linecap="round"></path>
                        <!-- End point dot -->
                        <circle cx="240" cy="20" r="3.5" fill="#F97316"></circle>
                      </svg>
                    </div>
                    
                    <!-- Months slider row -->
                    <div class="invoice-months-row">
                      <span>Dec</span>
                      <span>Jan</span>
                      <span>Feb</span>
                      <span>Mar</span>
                      <span>Apr</span>
                      <span class="active">May</span>
                    </div>
                    
                    <!-- Status metric cards (2x2 grid) -->
                    <div class="invoice-status-grid">
                      <div class="status-mini-card">
                        <div style="display: flex; align-items: center; gap: 4px;">
                          <span style="width: 6px; height: 6px; border-radius: 50%; background: #F97316;"></span>
                          <span class="status-lbl">Outstanding</span>
                        </div>
                        <span class="status-val">₹377</span>
                      </div>
                      <div class="status-mini-card">
                        <div style="display: flex; align-items: center; gap: 4px;">
                          <span style="width: 6px; height: 6px; border-radius: 50%; background: #22C55E;"></span>
                          <span class="status-lbl">Collected</span>
                        </div>
                        <span class="status-val">₹0</span>
                      </div>
                      <div class="status-mini-card">
                        <div style="display: flex; align-items: center; gap: 4px;">
                          <span style="width: 6px; height: 6px; border-radius: 50%; background: #EF4444;"></span>
                          <span class="status-lbl">Overdue</span>
                        </div>
                        <span class="status-val">0</span>
                      </div>
                      <div class="status-mini-card">
                        <div style="display: flex; align-items: center; gap: 4px;">
                          <span style="width: 6px; height: 6px; border-radius: 50%; background: #64748B;"></span>
                          <span class="status-lbl">Draft</span>
                        </div>
                        <span class="status-val">0</span>
                      </div>
                    </div>
                    
                    <!-- Filter and Invoices List -->
                    <div class="invoice-filter-tabs">
                      <span class="active">All 1</span>
                      <span>Unpaid 1</span>
                      <span>Paid</span>
                      <span>Overdue</span>
                      <span>Draft</span>
                    </div>
                    
                    <div class="invoice-item-card">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 28px; height: 28px; border-radius: 6px; background: #FFEDD5; display: flex; align-items: center; justify-content: center; color: #F97316;">
                          <i data-lucide="file-text" style="width: 14px; height: 14px;"></i>
                        </div>
                        <div style="display: flex; flex-direction: column;">
                          <span style="font-size: 11px; font-weight: 700; color: #1F2937;">agh</span>
                          <span style="font-size: 8px; color: #94A3B8;">INV-0007 • May 16, 2026</span>
                        </div>
                      </div>
                      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                        <span style="font-size: 11px; font-weight: 800; color: #1F2937;">₹377</span>
                        <span class="invoice-status-badge">Unpaid</span>
                      </div>
                    </div>
                  </div>
                  <!-- Bottom Home Indicator -->
                  <div class="screen-home-indicator"></div>
                </div>
              </div>
`;

  const updatedHtml = before + cleanScreensHtml + after;
  fs.writeFileSync(filePath, updatedHtml, 'utf8');
  console.log('Pruned, reconstructed, and saved all mockups screen data successfully!');
} else {
  console.error('Error: Did not find showcase screen container boundaries.');
}
