import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingBag, 
  Trash2, 
  ChevronRight, 
  Filter, 
  Search, 
  Database, 
  Info, 
  CheckCircle, 
  Loader, 
  X, 
  Plus, 
  Minus, 
  Sparkles, 
  FileSpreadsheet,
  Settings,
  HelpCircle,
  Clipboard,
  Check,
  ArrowUpDown,
  Lock,
  KeyRound,
  Globe,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';

// Default global credentials. Fill these in to connect instantly on Vercel without manual setup!
const GLOBAL_DEFAULT_SHEET_URL = 'https://script.google.com/macros/s/AKfycbwt2R0y8bw_lXajDaiOukD2exXYYnGCMb1vRyE4XbncUG2w9JQ7DBXkOLG5YR84BI4/exec'; 
const GLOBAL_DEFAULT_PASSCODE = 'bobseth';

// Backup offline / demo inventory loaded when Google Sheets isn't linked yet
const DEFAULT_CSV_DATA = `Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,Language,Purchase price currency,Added
Darkslick Shores,ONE,Phyrexia: All Will Be One,250,normal,rare,2,78812,bcbda15b-e49a-4445-a0e1-f221aa82c1e8,2.99,false,false,near_mint,en,USD,2025-10-05T14:38:01.559Z
Quicksilver Fisher,ONE,Phyrexia: All Will Be One,287,foil,common,4,78789,b394cdd1-a632-4b57-8356-4e2d9c9620f7,0.49,false,false,near_mint,en,USD,2025-10-05T14:38:01.559Z
Phyrexian Mite,TONE,Phyrexia: All Will Be One Tokens,12,normal,common,3,79059,a0b4b9cc-b0a4-4383-881b-e843e5d8a8c1,0.35,false,false,near_mint,en,USD,2025-10-05T14:38:01.559Z
Requiem Monolith,EOE,Edge of Eternities,113,normal,rare,1,107477,837d710a-652f-4c60-a52d-d786231160a4,0.49,false,false,near_mint,en,USD,2026-05-01T12:42:00.923Z
Fracture,STA,Strixhaven Mystical Archive,65,normal,rare,2,112588,34005b2e-6270-4ac3-9d35-021d916125ee,0.79,false,false,near_mint,en,USD,2026-05-01T12:42:00.924Z
Molten-Core Maestro,BIG,The Big Score,125,normal,rare,1,111697,326dfe32-3674-4a11-acd8-5ba62371235a,2.99,false,false,near_mint,en,USD,2026-05-01T12:42:00.924Z`;

export default function App() {
  const [cards, setCards] = useState([]);
  const [scryfallData, setScryfallData] = useState({});
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState({});
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedHeader, setCopiedHeader] = useState(false);
  const [isGlobalMode, setIsGlobalMode] = useState(false);
  
  // Storage configurations
  const [sheetUrl, setSheetUrl] = useState(() => {
    return localStorage.getItem('mtg_store_sheet_url') || GLOBAL_DEFAULT_SHEET_URL;
  });
  
  const [storedPasscode, setStoredPasscode] = useState(() => {
    return localStorage.getItem('mtg_store_owner_passcode') || GLOBAL_DEFAULT_PASSCODE;
  });
  
  const [passcodeAttempt, setPasscodeAttempt] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [isPasscodePromptOpen, setIsPasscodePromptOpen] = useState(false);
  const [isPasscodeSetupOpen, setIsPasscodeSetupOpen] = useState(false);

  // Search & Filtering States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRarities, setSelectedRarities] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [showFoilOnly, setShowFoilOnly] = useState(false);
  const [sortBy, setSortBy] = useState('price-desc');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);
  
  // Lazy-loaded visible items chunk limit (prevents rendering lockups on 2,400+ elements)
  const [visibleCount, setVisibleCount] = useState(80);

  // Ref locks to avoid calling concurrent duplicate Scryfall batch pulls
  const activeBackgroundFetch = useRef(null);

  const normalizeHeaderKey = (key) => {
    return key.toString().toLowerCase().trim().replace(/[\s_-]+/g, '');
  };

  const getCardUniqueId = (card) => {
    if (card.scryfallid && card.scryfallid.trim() !== '') return card.scryfallid.trim().toLowerCase();
    const name = (card.name || '').trim().toLowerCase();
    const set = (card.setcode || '').trim().toLowerCase();
    const num = (card.collectornumber || '').trim().toLowerCase();
    return `${name}-${set}-${num}`;
  };

  const isCardFoil = (card) => {
    const foilVal = card.foil?.toLowerCase() || '';
    return foilVal === 'foil' || foilVal === 'etched' || foilVal === 'yes' || foilVal === 'true' || foilVal === '1';
  };

  // Resilient internal CSV parsing fallback
  const parseCSV = (text) => {
    try {
      const rows = [];
      let currentRow = [];
      let currentField = '';
      let inQuotes = false;
      
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i+1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            currentField += '"';
            i++; 
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          currentRow.push(currentField.trim());
          currentField = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
          if (char === '\r' && nextChar === '\n') {
            i++; 
          }
          currentRow.push(currentField.trim());
          rows.push(currentRow);
          currentRow = [];
          currentField = '';
        } else {
          currentField += char;
        }
      }
      
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
      }

      if (rows.length < 2) return [];
      
      const headers = rows[0].map(h => h.trim().replace(/^"|"$/g, ''));
      const parsed = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length === 0 || (row.length === 1 && row[0] === '')) continue;
        if (row.length < headers.length) continue;

        const card = { rowId: `card-row-${i}` };

        headers.forEach((header, index) => {
          let val = row[index]?.replace(/^"|"$/g, '').trim() || '';
          const normHeader = normalizeHeaderKey(header);
          
          if (normHeader === 'quantity') {
            card.quantity = parseInt(val, 10) || 0;
          } else if (normHeader === 'purchaseprice') {
            card.purchaseprice = parseFloat(val) || 0;
          } else if (normHeader === 'set' || normHeader === 'setcode') {
            card.setcode = val;
          } else if (normHeader === 'scryfallid') {
            card.scryfallid = val;
          } else if (normHeader === 'rarity') {
            card.rarity = val;
          } else if (normHeader === 'foil') {
            card.foil = val;
          } else if (normHeader === 'name') {
            card.name = val;
          } else if (normHeader === 'collectornumber' || normHeader === 'collectornum') {
            card.collectornumber = val;
          } else if (normHeader === 'setname') {
            card.setname = val;
          } else {
            card[normHeader] = val;
          }
        });

        parsed.push(card);
      }
      return parsed;
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const showToast = (message, type = 'info') => {
    setAlertMsg({ message, type });
    setTimeout(() => {
      setAlertMsg(null);
    }, 4500);
  };

  const syncDatabaseWithBackend = async () => {
    if (!sheetUrl) {
      setIsGlobalMode(false);
      const saved = localStorage.getItem('mtg_store_inventory');
      const loaded = saved ? JSON.parse(saved) : parseCSV(DEFAULT_CSV_DATA);
      setCards(loaded);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(sheetUrl);
      if (response.ok) {
        const globalCards = await response.json();
        if (Array.isArray(globalCards)) {
          setCards(globalCards);
          setIsGlobalMode(true);
          localStorage.setItem('mtg_store_inventory', JSON.stringify(globalCards));
          showToast(`Successfully loaded ${globalCards.length} live cards directly from Google Sheets!`, 'success');
        } else {
          throw new Error("Invalid structure returned from Google Apps Script.");
        }
      } else {
        throw new Error("Network response was not OK");
      }
    } catch (err) {
      console.warn("Global Sheet fetch failed, restoring local backup cache:", err);
      setIsGlobalMode(false);
      const saved = localStorage.getItem('mtg_store_inventory');
      const loaded = saved ? JSON.parse(saved) : parseCSV(DEFAULT_CSV_DATA);
      setCards(loaded);
      showToast('Offline Mode: Operating from local device backup memory.', 'warning');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncDatabaseWithBackend();
  }, [sheetUrl]);

  useEffect(() => {
    localStorage.setItem('mtg_store_sheet_url', sheetUrl);
  }, [sheetUrl]);

  const fetchAllScryfallDetails = async (allCards) => {
    if (!allCards || allCards.length === 0) return;
    
    if (activeBackgroundFetch.current) {
      clearTimeout(activeBackgroundFetch.current);
    }

    const cardsToFetch = allCards.filter(card => {
      const cardId = getCardUniqueId(card);
      const hasDetail = scryfallData[cardId] || (card.scryfallid && scryfallData[card.scryfallid]);
      return !hasDetail;
    });

    if (cardsToFetch.length === 0) return;

    const identifiers = cardsToFetch.map(card => {
      if (card.scryfallid && card.scryfallid.trim() !== '') {
        return { id: card.scryfallid };
      } else if (card.name && card.setcode) {
        return { name: card.name, set: card.setcode.toLowerCase() };
      }
      return null;
    }).filter(Boolean);

    // Limit batches to Scryfall's maximum of 75 entries
    const batchSize = 75;
    const batches = [];
    for (let i = 0; i < identifiers.length; i += batchSize) {
      batches.push(identifiers.slice(i, i + batchSize));
    }

    let currentBatchIndex = 0;

    const fetchNextBatch = async () => {
      if (currentBatchIndex >= batches.length) {
        activeBackgroundFetch.current = null;
        return;
      }

      const batch = batches[currentBatchIndex];
      try {
        const response = await fetch('https://api.scryfall.com/cards/collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifiers: batch })
        });

        if (response.ok) {
          const result = await response.json();
          const newDetails = {};
          if (result.data) {
            result.data.forEach(scryCard => {
              if (scryCard) {
                let colors = scryCard.colors || [];
                if (scryCard.card_faces && colors.length === 0) {
                  colors = scryCard.card_faces.reduce((acc, face) => {
                    return [...acc, ...(face.colors || [])];
                  }, []);
                }

                const cardDetail = {
                  image: scryCard.image_uris?.normal || 
                         scryCard.card_faces?.[0]?.image_uris?.normal || 
                         `https://api.scryfall.com/cards/${scryCard.set}/${scryCard.collector_number}/?format=image&version=normal`,
                  colors: colors,
                  mana_cost: scryCard.mana_cost || scryCard.card_faces?.[0]?.mana_cost || '',
                  type_line: scryCard.type_line || '',
                  oracle_text: scryCard.oracle_text || '',
                  usd_price: scryCard.prices?.usd || scryCard.prices?.usd_foil || '—'
                };

                if (scryCard.id) newDetails[scryCard.id] = cardDetail;
                const fallbackKey = `${scryCard.name?.toLowerCase()}-${scryCard.set?.toLowerCase()}`;
                newDetails[fallbackKey] = cardDetail;
              }
            });
          }
          setScryfallData(prev => ({ ...prev, ...newDetails }));
        }
      } catch (err) {
        console.warn('Scryfall metadata pipeline stalled briefly:', err);
      }

      currentBatchIndex++;
      // Safe compliance delay matching Scryfall guidelines
      activeBackgroundFetch.current = setTimeout(fetchNextBatch, 150);
    };

    fetchNextBatch();
  };

  useEffect(() => {
    if (cards.length > 0) {
      fetchAllScryfallDetails(cards);
    }
    return () => {
      if (activeBackgroundFetch.current) {
        clearTimeout(activeBackgroundFetch.current);
      }
    };
  }, [cards]);

  const getCardDetails = (card) => {
    if (card.scryfallid && scryfallData[card.scryfallid]) {
      return scryfallData[card.scryfallid];
    }
    const fallbackKey = `${card.name?.toLowerCase()}-${card.setcode?.toLowerCase()}`;
    return scryfallData[fallbackKey] || {};
  };

  const addToCart = (card) => {
    const cardId = getCardUniqueId(card);
    const maxQty = parseInt(card.quantity) || 0;
    const currentQty = cart[cardId]?.quantity || 0;

    if (maxQty <= 0) {
      showToast('This card is currently sold out.', 'error');
      return;
    }

    if (currentQty >= maxQty) {
      showToast(`Cannot add more. Only ${maxQty} remaining in stock.`, 'warning');
      return;
    }

    setCart(prev => ({
      ...prev,
      [cardId]: {
        card,
        quantity: currentQty + 1
      }
    }));
  };

  const removeFromCart = (cardId, fullyRemove = false) => {
    setCart(prev => {
      const next = { ...prev };
      if (!next[cardId]) return prev;

      if (fullyRemove || next[cardId].quantity <= 1) {
        delete next[cardId];
      } else {
        next[cardId].quantity -= 1;
      }
      return next;
    });
  };

  const cartTotalItemsCount = useMemo(() => {
    return Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const subtotalPreMultiplier = useMemo(() => {
    return Object.values(cart).reduce((sum, item) => {
      const price = parseFloat(item.card.purchaseprice) || 0;
      return sum + (price * item.quantity);
    }, 0);
  }, [cart]);

  const cartMultiplier = useMemo(() => {
    if (cartTotalItemsCount >= 10) return 2.0;
    if (cartTotalItemsCount >= 5) return 2.3;
    if (cartTotalItemsCount >= 1) return 2.5;
    return 1.0;
  }, [cartTotalItemsCount]);

  const finalTotalRM = useMemo(() => {
    return subtotalPreMultiplier * cartMultiplier;
  }, [subtotalPreMultiplier, cartMultiplier]);

  const colorOptions = [
    { code: 'W', name: 'White', colorClass: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    { code: 'U', name: 'Blue', colorClass: 'bg-blue-100 text-blue-800 border-blue-300' },
    { code: 'B', name: 'Black', colorClass: 'bg-zinc-800 text-zinc-100 border-zinc-600' },
    { code: 'R', name: 'Red', colorClass: 'bg-red-100 text-red-800 border-red-300' },
    { code: 'G', name: 'Green', colorClass: 'bg-green-100 text-green-800 border-green-300' },
    { code: 'C', name: 'Colorless', colorClass: 'bg-slate-200 text-slate-800 border-slate-400' },
    { code: 'M', name: 'Multicolor', colorClass: 'bg-gradient-to-r from-orange-400 via-yellow-400 to-teal-400 text-slate-900 border-orange-300' }
  ];

  const rarityOptions = ['common', 'uncommon', 'rare', 'mythic'];

  const toggleColorFilter = (colorCode) => {
    setSelectedColors(prev => 
      prev.includes(colorCode) ? prev.filter(c => c !== colorCode) : [...prev, colorCode]
    );
  };

  const toggleRarityFilter = (rarity) => {
    setSelectedRarities(prev => 
      prev.includes(rarity) ? prev.filter(r => r !== rarity) : [...prev, rarity]
    );
  };

  const filteredAndSortedCards = useMemo(() => {
    const filtered = cards.filter(card => {
      const details = getCardDetails(card);

      const nameMatch = card.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        card.setname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        card.setcode?.toLowerCase().includes(searchQuery.toLowerCase());
      if (!nameMatch) return false;

      if (selectedRarities.length > 0) {
        const cardRarity = card.rarity?.toLowerCase() || '';
        const match = selectedRarities.some(r => cardRarity.includes(r));
        if (!match) return false;
      }

      if (showFoilOnly) {
        if (!isCardFoil(card)) return false;
      }

      if (selectedColors.length > 0) {
        if (!details.colors) return false;

        const cardColors = details.colors || [];
        const hasColorlessSelected = selectedColors.includes('C');
        const hasMulticolorSelected = selectedColors.includes('M');
        const specificColorFilters = selectedColors.filter(c => c !== 'C' && c !== 'M');

        let matches = false;

        if (hasColorlessSelected && cardColors.length === 0) matches = true;
        if (hasMulticolorSelected && cardColors.length > 1) matches = true;
        if (specificColorFilters.length > 0 && cardColors.length > 0) {
          const hasAny = cardColors.some(col => specificColorFilters.includes(col));
          if (hasAny) matches = true;
        }

        if (!matches) return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'price-asc') {
        const priceA = parseFloat(a.purchaseprice) || 0;
        const priceB = parseFloat(b.purchaseprice) || 0;
        return priceA - priceB;
      }
      if (sortBy === 'price-desc') {
        const priceA = parseFloat(a.purchaseprice) || 0;
        const priceB = parseFloat(b.purchaseprice) || 0;
        return priceB - priceA;
      }
      if (sortBy === 'name-asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'name-desc') {
        return (b.name || '').localeCompare(a.name || '');
      }
      return 0;
    });
  }, [cards, scryfallData, searchQuery, selectedRarities, selectedColors, showFoilOnly, sortBy]);

  const handleSettingsClick = () => {
    if (!storedPasscode) {
      setIsPasscodeSetupOpen(true);
    } else {
      setIsPasscodePromptOpen(true);
    }
  };

  const handleCreatePasscode = (e) => {
    e.preventDefault();
    if (!newPasscode.trim()) {
      showToast('Please enter a valid passcode.', 'warning');
      return;
    }
    localStorage.setItem('mtg_store_owner_passcode', newPasscode);
    setStoredPasscode(newPasscode);
    setIsPasscodeSetupOpen(false);
    setIsSettingsOpen(true);
    setNewPasscode('');
    showToast('Storeowner Passcode successfully created!', 'success');
  };

  const handleVerifyPasscode = (e) => {
    e.preventDefault();
    if (passcodeAttempt === storedPasscode) {
      setIsPasscodePromptOpen(false);
      setIsSettingsOpen(true);
      setPasscodeAttempt('');
      showToast('Access Granted.', 'success');
    } else {
      showToast('Incorrect passcode. Access Denied.', 'error');
      setPasscodeAttempt('');
    }
  };

  const handleChangePasscodeInsideSettings = () => {
    const freshPass = prompt('Enter a new security passcode:');
    if (freshPass && freshPass.trim()) {
      localStorage.setItem('mtg_store_owner_passcode', freshPass.trim());
      setStoredPasscode(freshPass.trim());
      showToast('Owner passcode changed successfully!', 'success');
    }
  };

  const googleAppsScriptCode = `function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Inventory");
  
  if (!sheet) {
    sheet = ss.insertSheet("Inventory");
    sheet.appendRow(["Name", "Set code", "Set name", "Collector number", "Foil", "Rarity", "Quantity", "Scryfall ID", "Purchase price"]);
    sheet.appendRow(["Darkslick Shores", "ONE", "Phyrexia: All Will Be One", "250", "normal", "rare", "2", "bcbda15b-e49a-4445-a0e1-f221aa82c1e8", "2.99"]);
    sheet.appendRow(["Quicksilver Fisher", "ONE", "Phyrexia: All Will Be One", "287", "foil", "common", "4", "b394cdd1-a632-4b57-8356-4e2d9c9620f7", "0.49"]);
  }
  
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return ContentService.createTextOutput(JSON.stringify([]))
                         .setMimeType(ContentService.MimeType.JSON);
  }

  var headers = data[0].map(function(h) { 
    return h.toString().toLowerCase().trim().replace(/[\\s_-]+/g, ''); 
  });
  
  var cards = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row.join("").trim() === "") continue; // skip blank pasted lines
    
    var card = { rowId: "card-row-" + i };
    for (var j = 0; j < headers.length; j++) {
      var val = row[j];
      var header = headers[j];
      
      if (header === 'quantity') {
        card.quantity = parseInt(val) || 0;
      } else if (header === 'purchaseprice') {
        card.purchaseprice = parseFloat(val) || 0;
      } else if (header === 'set' || header === 'setcode') {
        card.setcode = val.toString().trim();
      } else if (header === 'scryfallid') {
        card.scryfallid = val.toString().trim();
      } else if (header === 'rarity') {
        card.rarity = val.toString().trim();
      } else if (header === 'foil') {
        card.foil = val.toString().trim();
      } else if (header === 'name') {
        card.name = val.toString().trim();
      } else if (header === 'collectornumber' || header === 'collectornum') {
        card.collectornumber = val.toString().trim();
      } else if (header === 'setname') {
        card.setname = val.toString().trim();
      } else {
        card[header] = val;
      }
    }
    cards.push(card);
  }
  
  return ContentService.createTextOutput(JSON.stringify(cards))
                       .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var jsonString = e.postData.contents;
    var data = JSON.parse(jsonString);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (data.action === "checkout") {
      var invSheet = ss.getSheetByName("Inventory");
      if (!invSheet) {
        return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": "Inventory sheet missing." }))
                             .setMimeType(ContentService.MimeType.JSON);
      }
      
      var invData = invSheet.getDataRange().getValues();
      var nameCol = -1, setCol = -1, numCol = -1, qtyCol = -1, scryIdCol = -1;
      var headers = invData[0].map(function(h) { return h.toString().toLowerCase().trim().replace(/[\\s_-]+/g, ''); });
      
      for (var j = 0; j < headers.length; j++) {
        if (headers[j] === 'name') nameCol = j;
        if (headers[j] === 'setcode' || headers[j] === 'set') setCol = j;
        if (headers[j] === 'collectornumber' || headers[j] === 'collectornum') numCol = j;
        if (headers[j] === 'quantity') qtyCol = j;
        if (headers[j] === 'scryfallid') scryIdCol = j;
      }
      
      var items = data.items;
      // High-performance direct row modification
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var orderedQty = parseInt(item.quantity) || 0;
        
        for (var r = 1; r < invData.length; r++) {
          var matched = false;
          
          // Match by Scryfall ID first for absolute accuracy
          if (scryIdCol !== -1 && item.scryfallid && invData[r][scryIdCol]) {
            if (invData[r][scryIdCol].toString().trim().toLowerCase() === item.scryfallid.trim().toLowerCase()) {
              matched = true;
            }
          }
          
          // Fallback to name/set/collector number matching
          if (!matched) {
            var sName = invData[r][nameCol] ? invData[r][nameCol].toString().trim().toLowerCase() : "";
            var sSet = invData[r][setCol] ? invData[r][setCol].toString().trim().toLowerCase() : "";
            var sNum = invData[r][numCol] ? invData[r][numCol].toString().trim().toLowerCase() : "";
            
            var iName = item.name ? item.name.toString().trim().toLowerCase() : "";
            var iSet = item.set ? item.set.toString().trim().toLowerCase() : "";
            var iNum = item.collectorNumber ? item.collectorNumber.toString().trim().toLowerCase() : "";
            
            if (sName === iName && sSet === iSet && sNum === iNum) {
              matched = true;
            }
          }
          
          if (matched && qtyCol !== -1) {
            var currentQty = parseInt(invData[r][qtyCol]) || 0;
            var nextQty = Math.max(0, currentQty - orderedQty);
            invSheet.getRange(r + 1, qtyCol + 1).setValue(nextQty);
            break; 
          }
        }
      }
      
      // Append order details log
      var orderSheet = ss.getSheetByName("Orders");
      if (!orderSheet) {
        orderSheet = ss.insertSheet("Orders");
        orderSheet.appendRow(["Timestamp", "Customer Name", "Phone Number", "Total Value", "Card Orders"]);
      }
      
      var ordersSummary = items.map(function(item) {
        return item.name + " (" + item.set + " #" + item.collectorNumber + ") x" + item.quantity;
      }).join(", ");
      
      orderSheet.appendRow([
        new Date(),
        data.buyerName,
        data.buyerPhone,
        data.totalValue.toFixed(2) + " RM",
        ordersSummary
      ]);
      
      return ContentService.createTextOutput(JSON.stringify({ "status": "success", "message": "Order processed and quantities updated!" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const copyScriptToClipboard = () => {
    navigator.clipboard.writeText(googleAppsScriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
    showToast('Batch-Action Apps Script code copied to clipboard!', 'success');
  };

  const copyHeaderToClipboard = () => {
    const headers = "Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,Scryfall ID,Purchase price";
    navigator.clipboard.writeText(headers);
    setCopiedHeader(true);
    setTimeout(() => setCopiedHeader(false), 3000);
    showToast('Headers template copied to clipboard!', 'success');
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!buyerName.trim() || !buyerPhone.trim()) {
      showToast('Please enter both name and phone number to place your order.', 'warning');
      return;
    }

    if (Object.keys(cart).length === 0) {
      showToast('Your shopping cart is empty.', 'warning');
      return;
    }

    const updatedCards = cards.map(card => {
      const cardId = getCardUniqueId(card);
      const cartItem = cart[cardId];
      if (cartItem) {
        const currentQty = parseInt(card.quantity) || 0;
        const soldQty = parseInt(cartItem.quantity) || 0;
        return { ...card, quantity: Math.max(0, currentQty - soldQty) };
      }
      return card;
    });

    const payload = {
      action: "checkout",
      buyerName,
      buyerPhone,
      totalValue: finalTotalRM,
      items: Object.values(cart).map(item => ({
        name: item.card.name,
        set: item.card.setcode,
        set_name: item.card.setname,
        collectorNumber: item.card.collectornumber,
        foil: item.card.foil,
        quantity: item.quantity,
        scryfallid: item.card.scryfallid || '',
        price: parseFloat(item.card.purchaseprice) || 0
      }))
    };

    setSubmittingOrder(true);

    if (!sheetUrl || !isGlobalMode) {
      setTimeout(() => {
        setSubmittingOrder(false);
        setOrderSubmitted(true);
        setCards(updatedCards);
        setCart({});
        localStorage.setItem('mtg_store_inventory', JSON.stringify(updatedCards));
        showToast('Demo checkout successful! Data updated inside this local browser.', 'info');
      }, 1500);
      return;
    }

    try {
      await fetch(sheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });

      setSubmittingOrder(false);
      setOrderSubmitted(true);
      setCart({});
      showToast('Order completed! Google Sheet cells updated live.', 'success');
      
      setTimeout(() => {
        syncDatabaseWithBackend();
      }, 1800);
    } catch (error) {
      console.error(error);
      setSubmittingOrder(false);
      showToast('Error communicating with Google Sheets. Local data maintained.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-rose-500 selection:text-white">
      {alertMsg && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl transition-all border transform translate-y-0 scale-100 ${
          alertMsg.type === 'success' ? 'bg-emerald-950 text-emerald-200 border-emerald-500' :
          alertMsg.type === 'error' ? 'bg-rose-950 text-rose-200 border-rose-500' :
          alertMsg.type === 'warning' ? 'bg-amber-950 text-amber-200 border-amber-500' :
          'bg-slate-900 text-sky-200 border-sky-500'
        }`}>
          <div className="text-sm font-semibold">{alertMsg.message}</div>
          <button onClick={() => setAlertMsg(null)} className="text-current opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-rose-500 to-purple-600 rounded-xl text-white shadow-md">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-rose-400 bg-clip-text text-transparent">
                  Planeswalker Bazaar
                </h1>
                {isGlobalMode ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-950/80 text-emerald-400 border border-emerald-800 animate-pulse">
                    <Wifi className="w-2.5 h-2.5" /> GLOBAL LIVE
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-950/80 text-amber-400 border border-amber-800">
                    <WifiOff className="w-2.5 h-2.5" /> LOCAL DEMO
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">Sheet-Driven Collaborative MTG Shop</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isGlobalMode && (
              <button
                onClick={syncDatabaseWithBackend}
                disabled={loading}
                className="p-2.5 bg-slate-800 text-slate-300 hover:text-white rounded-xl transition border border-slate-700/60 flex items-center gap-1.5"
                title="Sync sheet data"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-rose-400' : ''}`} />
                <span className="text-xs font-semibold hidden md:inline">Sync Sheet</span>
              </button>
            )}
            <button
              onClick={handleSettingsClick}
              className="p-2.5 bg-slate-800 text-slate-300 hover:text-white rounded-xl transition duration-200 border border-slate-700/60 flex items-center gap-1.5"
              title="Store Owner Settings"
            >
              <Settings className="w-5 h-5" />
              <span className="text-xs font-semibold hidden md:inline">Admin Settings</span>
            </button>
            <button
              onClick={() => setIsCartOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-medium transition duration-200 shadow-md shadow-rose-900/20"
            >
              <ShoppingBag className="w-5 h-5" />
              <span className="hidden sm:inline">Shopping Cart</span>
              <span className="bg-slate-950 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-1">
                {cartTotalItemsCount}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner Section */}
      <section className="relative overflow-hidden bg-slate-900 py-12 border-b border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(244,63,94,0.1),transparent)]"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-950/50 text-rose-400 text-xs font-semibold rounded-full border border-rose-900/60 mb-4">
                <Globe className="w-3.5 h-3.5" /> No file uploads required! Paste cards directly in Google Sheets.
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3">
                Browse My Live Card Inventory
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                This store is powered entirely by a Google Sheet database. Select cards to add to your cart, submit checkout, and the system will instantly update sheet inventory.
              </p>
              <div className="space-y-1 mb-6 border-l-2 border-rose-500 pl-4 py-1">
                <p className="text-slate-300 text-sm font-semibold">1-4 cards: Subtotal x 2.5 RM</p>
                <p className="text-slate-300 text-sm font-semibold">5-9 cards: Subtotal x 2.3 RM</p>
                <p className="text-slate-300 text-sm font-semibold">10 or more cards: Subtotal x 2.0 RM</p>
              </div>
              <div className="text-xs text-slate-400">
                Currently showcasing <strong className="text-slate-200">{cards.length}</strong> unique database listings
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Grid & Filters Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="lg:flex lg:gap-8">
          
          <aside className="lg:w-64 flex-none space-y-6 mb-8 lg:mb-0">
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
                <span className="font-bold text-slate-200 flex items-center gap-2">
                  <Filter className="w-4 h-4 text-rose-500" />
                  Filters
                </span>
                {(selectedColors.length > 0 || selectedRarities.length > 0 || showFoilOnly || searchQuery) && (
                  <button
                    onClick={() => {
                      setSelectedColors([]);
                      setSelectedRarities([]);
                      setShowFoilOnly(false);
                      setSearchQuery('');
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300 font-medium transition"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Search Cards</label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Name, set, keyword..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 text-white rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500 transition"
                  />
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Color Identity</label>
                <div className="flex flex-wrap gap-1.5">
                  {colorOptions.map((opt) => {
                    const isSelected = selectedColors.includes(opt.code);
                    return (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() => toggleColorFilter(opt.code)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                          isSelected 
                            ? opt.colorClass + ' ring-2 ring-offset-2 ring-offset-slate-950 ring-rose-500' 
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                        title={opt.name}
                      >
                        {opt.code}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Rarity</label>
                <div className="space-y-2">
                  {rarityOptions.map((rarity) => {
                    const isSelected = selectedRarities.includes(rarity);
                    return (
                      <button
                        key={rarity}
                        type="button"
                        onClick={() => toggleRarityFilter(rarity)}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl border text-xs font-medium capitalize transition ${
                          isSelected
                            ? 'bg-rose-950/40 text-rose-300 border-rose-500'
                            : 'bg-slate-950 text-slate-400 border-slate-800/80 hover:bg-slate-800/50 hover:text-slate-200'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${
                            rarity === 'mythic' ? 'bg-orange-500' :
                            rarity === 'rare' ? 'bg-amber-400' :
                            rarity === 'uncommon' ? 'bg-slate-300' : 'bg-slate-500'
                          }`} />
                          {rarity}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-rose-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <label className="flex items-center gap-2.5 cursor-pointer select-none py-1.5">
                  <input
                    type="checkbox"
                    checked={showFoilOnly}
                    onChange={(e) => setShowFoilOnly(e.target.checked)}
                    className="rounded text-rose-500 bg-slate-950 border-slate-800 focus:ring-0 focus:ring-offset-0 focus:outline-none w-4 h-4"
                  />
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Foil Cards Only
                  </span>
                </label>
              </div>

            </div>
          </aside>

          {/* Card Tiles Section */}
          <div className="flex-1">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-900">
              <h3 className="text-sm font-semibold text-slate-400">
                Showing <strong className="text-white">{Math.min(filteredAndSortedCards.length, visibleCount)}</strong> of {filteredAndSortedCards.length} matching cards
              </h3>
              
              <div className="flex items-center gap-2.5">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" /> Sort By:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 pr-8 focus:outline-none focus:ring-1 focus:ring-rose-500 transition cursor-pointer font-medium appearance-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 8px center',
                    backgroundSize: '16px'
                  }}
                >
                  <option value="price-desc">Price (High to Low)</option>
                  <option value="price-asc">Price (Low to High)</option>
                  <option value="name-asc">Alphabetical (A - Z)</option>
                  <option value="name-desc">Alphabetical (Z - A)</option>
                </select>

                {loading && (
                  <div className="flex items-center gap-2 text-rose-400 text-xs ml-2 animate-pulse">
                    <Loader className="w-3.5 h-3.5 animate-spin" /> Synchronizing...
                  </div>
                )}
              </div>
            </div>

            {filteredAndSortedCards.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl py-16 px-4 text-center">
                <Database className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h4 className="text-lg font-bold text-white mb-1">No Cards Found</h4>
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                  We couldn't find any cards matching your filters. Ensure you've pasted your inventory into Google Sheet and loaded it correctly.
                </p>
                <button
                  onClick={() => {
                    setSelectedColors([]);
                    setSelectedRarities([]);
                    setShowFoilOnly(false);
                    setSearchQuery('');
                  }}
                  className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
                >
                  Reset Active Filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredAndSortedCards.slice(0, visibleCount).map((card) => {
                    const details = getCardDetails(card);
                    const isFoil = isCardFoil(card);
                    const cardId = getCardUniqueId(card);
                    const inCartCount = cart[cardId]?.quantity || 0;
                    const originalQty = parseInt(card.quantity) || 0;
                    const availableQty = originalQty - inCartCount;

                    const isSoldOut = originalQty <= 0;

                    return (
                      <div 
                        key={card.rowId}
                        onClick={() => !isSoldOut && availableQty > 0 && addToCart(card)}
                        className={`group relative bg-slate-900 rounded-2xl overflow-hidden border transition-all duration-300 flex flex-col justify-between cursor-pointer ${
                          isSoldOut 
                            ? 'border-slate-800/40 opacity-50 cursor-not-allowed select-none' 
                            : availableQty === 0 
                              ? 'border-slate-800 opacity-60' 
                              : 'border-slate-800/80 hover:border-slate-700 hover:shadow-xl hover:shadow-slate-950/50 hover:-translate-y-1'
                        }`}
                      >
                        {isFoil && !isSoldOut && (
                          <div className="absolute inset-0 pointer-events-none rounded-2xl opacity-15 bg-gradient-to-tr from-pink-500 via-purple-500 to-teal-500 z-10 animate-pulse"></div>
                        )}

                        <div className="absolute top-2 left-2 z-20 flex gap-1">
                          {isFoil && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-gradient-to-r from-pink-500 to-indigo-600 text-white font-bold text-[9px] uppercase tracking-wider rounded-md shadow-sm">
                              <Sparkles className="w-2.5 h-2.5" /> Foil
                            </span>
                          )}
                          <span className={`px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold rounded-md text-white shadow-sm ${
                            card.rarity?.toLowerCase().includes('mythic') ? 'bg-orange-600' :
                            card.rarity?.toLowerCase().includes('rare') ? 'bg-amber-500' :
                            card.rarity?.toLowerCase().includes('uncommon') ? 'bg-slate-600' :
                            'bg-zinc-700'
                          }`}>
                            {card.rarity || 'Common'}
                          </span>
                        </div>

                        <div className="absolute top-2 right-2 z-20">
                          {isSoldOut ? (
                            <span className="px-2 py-0.5 bg-red-950/90 text-red-200 text-xs font-bold rounded-md border border-red-800 shadow-sm">
                              SOLD OUT
                            </span>
                          ) : availableQty > 0 ? (
                            <span className="px-2 py-0.5 bg-slate-950/80 backdrop-blur-md text-slate-200 text-xs font-semibold rounded-md border border-slate-700">
                              Qty: {availableQty}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-950/90 text-amber-200 text-xs font-bold rounded-md border border-amber-800 shadow-sm">
                              ALL SELECTED
                            </span>
                          )}
                        </div>

                        <div className={`relative aspect-[3/4] bg-slate-950 overflow-hidden flex items-center justify-center ${isSoldOut ? 'grayscale contrast-75' : ''}`}>
                          {details.image ? (
                            <img
                              src={details.image}
                              alt={card.name || 'MTG Card'}
                              loading="lazy"
                              className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-2 p-4 text-center">
                              <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center animate-pulse">
                                <Database className="w-5 h-5 text-slate-600" />
                              </div>
                              <span className="text-[10px] text-slate-500 animate-pulse">Background Sync...</span>
                            </div>
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-4">
                            <span className="text-xs font-medium text-slate-300 truncate">
                              {card.setname || 'Set'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Set Code: {card.setcode} • No: {card.collectornumber}
                            </span>
                          </div>

                          {inCartCount > 0 && (
                            <div className="absolute inset-0 bg-rose-600/20 backdrop-blur-sm flex items-center justify-center z-15">
                              <div className="bg-rose-600 text-white font-extrabold text-sm px-4 py-2 rounded-xl shadow-lg border border-rose-400">
                                Selected x{inCartCount}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="p-4 bg-slate-900 border-t border-slate-800 flex-grow flex flex-col justify-between">
                          <h4 className={`font-bold text-sm group-hover:text-rose-400 transition truncate ${isSoldOut ? 'text-slate-500 line-through' : 'text-white'}`} title={card.name}>
                            {card.name}
                          </h4>
                          
                          <div className="mt-3 flex items-center justify-between">
                            <div>
                              <span className="text-[11px] text-slate-500 block uppercase font-bold tracking-wider">Store Price</span>
                              <span className={`text-lg font-extrabold ${isSoldOut ? 'text-slate-600' : 'text-rose-400'}`}>
                                ${parseFloat(card.purchaseprice || 0).toFixed(2)}
                              </span>
                            </div>

                            {isSoldOut ? (
                              <button disabled className="px-3 py-1.5 bg-slate-950 text-slate-600 rounded-lg text-xs font-bold cursor-not-allowed border border-slate-800">
                                SOLD OUT
                              </button>
                            ) : availableQty > 0 ? (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToCart(card);
                                }}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition duration-200"
                              >
                                Select
                              </button>
                            ) : (
                              <button disabled className="px-3 py-1.5 bg-slate-950 text-amber-500 rounded-lg text-xs font-bold cursor-not-allowed border border-slate-800">
                                Selected
                              </button>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>

                {filteredAndSortedCards.length > visibleCount && (
                  <div className="mt-12 text-center">
                    <button
                      onClick={() => setVisibleCount(prev => prev + 80)}
                      className="px-8 py-4 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold text-sm rounded-xl transition duration-200 shadow-md animate-pulse"
                    >
                      Show More Cards
                    </button>
                  </div>
                )}
              </>
            )}

          </div>

        </div>
      </main>

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div 
            onClick={() => setIsCartOpen(false)} 
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
          />

          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md transform transition-all">
              <div className="h-full flex flex-col bg-slate-900 shadow-2xl border-l border-slate-800">
                
                <div className="px-6 py-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-rose-500" />
                    <h3 className="font-bold text-lg text-white">Your Selections</h3>
                  </div>
                  <button 
                    onClick={() => setIsCartOpen(false)}
                    className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {orderSubmitted ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-emerald-950 border border-emerald-500 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <CheckCircle className="w-10 h-10" />
                      </div>
                      <h4 className="text-xl font-bold text-white mb-2">Order Submitted!</h4>
                      <p className="text-slate-400 text-sm max-w-xs mx-auto mb-6">
                        Thank you! Your global checkout order has been logged in the active database. Current stock is updated.
                      </p>
                      <button
                        onClick={() => {
                          setOrderSubmitted(false);
                          syncDatabaseWithBackend();
                        }}
                        className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition"
                      >
                        Keep Browsing
                      </button>
                    </div>
                  ) : Object.keys(cart).length === 0 ? (
                    <div className="text-center py-16 text-slate-500">
                      <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-slate-700" />
                      <p className="text-sm font-semibold">Your shopping cart is empty.</p>
                      <p className="text-xs text-slate-600 mt-1">Select cards from the storefront to assemble your purchase ledger.</p>
                    </div>
                  ) : (
                    <>
                      <div className="divide-y divide-slate-800">
                        {Object.values(cart).map((item) => {
                          const details = getCardDetails(item.card);
                          const isFoil = isCardFoil(item.card);
                          const cardId = getCardUniqueId(item.card);
                          const cardPrice = parseFloat(item.card.purchaseprice || 0);

                          return (
                            <div key={cardId} className="py-4 flex gap-4">
                              <div className="w-16 aspect-[3/4] rounded-lg overflow-hidden bg-slate-950 flex-none border border-slate-800">
                                {details.image ? (
                                  <img src={details.image} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-slate-950">
                                    <Database className="w-4 h-4 text-slate-700" />
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <h5 className="font-bold text-sm text-white truncate" title={item.card.name}>
                                  {item.card.name}
                                </h5>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="text-[10px] text-slate-400 capitalize bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                    {item.card.setcode} #{item.card.collectornumber}
                                  </span>
                                  {isFoil && (
                                    <span className="text-[10px] text-pink-400 font-bold px-1.5 bg-pink-950/40 rounded border border-pink-900/60">
                                      Foil
                                    </span>
                                  )}
                                </div>
                                
                                <div className="flex items-center justify-between mt-3">
                                  <span className="text-sm font-extrabold text-rose-400">
                                    ${(cardPrice * item.quantity).toFixed(2)}
                                  </span>

                                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                                    <button 
                                      type="button"
                                      onClick={() => removeFromCart(cardId, false)}
                                      className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="text-xs font-bold px-1.5 text-slate-200">{item.quantity}</span>
                                    <button 
                                      type="button"
                                      onClick={() => addToCart(item.card)}
                                      className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <button 
                                type="button"
                                onClick={() => removeFromCart(cardId, true)}
                                className="text-slate-600 hover:text-rose-500 p-1 self-start transition ml-2"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <form onSubmit={handleCheckout} className="pt-6 border-t border-slate-800 space-y-4">
                        <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Buyer Information</h4>
                        
                        <div>
                          <label className="block text-xs text-slate-400 mb-1.5">Your Full Name</label>
                          <input
                            type="text"
                            required
                            placeholder="Liliana Vess"
                            value={buyerName}
                            onChange={(e) => setBuyerName(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-slate-400 mb-1.5">Phone Number</label>
                          <input
                            type="tel"
                            required
                            placeholder="+1 (555) 000-0000"
                            value={buyerPhone}
                            onChange={(e) => setBuyerPhone(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition"
                          />
                        </div>

                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2 mt-2">
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>Base Subtotal</span>
                            <span>{subtotalPreMultiplier.toFixed(2)} USD</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>Volume Multiplier ({cartTotalItemsCount} cards)</span>
                            <span className="text-amber-400 font-bold">x{cartMultiplier.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between text-sm font-bold text-slate-200 border-t border-slate-900 pt-2">
                            <span>Final Total</span>
                            <span className="text-rose-400 text-lg font-extrabold">{finalTotalRM.toFixed(2)} RM</span>
                          </div>
                        </div>

                        {!sheetUrl && (
                          <div className="p-3 bg-amber-950/40 border border-amber-900/60 rounded-xl text-xs text-amber-300 flex gap-2">
                            <Info className="w-4 h-4 text-amber-400 flex-none mt-0.5" />
                            <span>
                              Storeowner: No Google Sheets URL is set. Placing order will simulate a checkout. Set it up using the Settings gear.
                            </span>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={submittingOrder}
                          className="w-full py-3 bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white font-bold rounded-xl transition shadow-lg shadow-rose-950/30 flex items-center justify-center gap-2"
                        >
                          {submittingOrder ? (
                            <>
                              <Loader className="w-4 h-4 animate-spin" />
                              <span>Sending Purchase...</span>
                            </>
                          ) : (
                            <>
                              <span>Complete Checkout</span>
                              <ChevronRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </form>
                    </>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Passcode Setup Modal */}
      {isPasscodeSetupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsPasscodeSetupOpen(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
          <div className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 sm:p-8 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-purple-950/50 border border-purple-500 flex items-center justify-center text-purple-400 mb-4 animate-bounce">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-white mb-2">Create Admin Passcode</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Welcome! Since this is your first time accessing the Admin menu, please configure a custom secret passcode. Only you will be able to access settings and inventory layouts from this browser.
            </p>
            <form onSubmit={handleCreatePasscode} className="space-y-4">
              <input
                type="password"
                required
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value)}
                placeholder="Enter secret passcode"
                className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition text-center font-mono tracking-widest text-lg"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPasscodeSetupOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition shadow-lg"
                >
                  Create Passcode
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Password Verification Gate */}
      {isPasscodePromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsPasscodePromptOpen(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
          <div className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 sm:p-8 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-950/50 border border-rose-500 flex items-center justify-center text-rose-400 mb-4">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-white mb-2">Storeowner Verification</h3>
            <p className="text-xs text-slate-400 mb-6">
              Enter your passcode to open settings and synchronize your Google Sheet.
            </p>
            <form onSubmit={handleVerifyPasscode} className="space-y-4">
              <input
                type="password"
                required
                autoFocus
                value={passcodeAttempt}
                onChange={(e) => setPasscodeAttempt(e.target.value)}
                placeholder="••••"
                className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-rose-500 transition text-center font-mono tracking-widest text-lg"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPasscodePromptOpen(false);
                    setPasscodeAttempt('');
                  }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition shadow-lg"
                >
                  Verify Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Configuration & Setup Guide (Settings Modal) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setIsSettingsOpen(false)} 
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />

          <div className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl p-6 sm:p-8">
            <button 
              onClick={() => setIsSettingsOpen(false)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between border-b border-slate-800 pb-5 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-950 border border-purple-500 text-purple-400 rounded-xl">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xl text-white">Direct Spreadsheet Setup</h3>
                  <p className="text-xs text-slate-400">How to copy-paste your cards and synchronize them globally</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleChangePasscodeInsideSettings}
                className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition"
              >
                Change Passcode
              </button>
            </div>

            <div className="space-y-6">
              
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                <h4 className="text-sm font-bold text-slate-200 mb-2">Google Apps Script Web App URL</h4>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Provide your published deployment web app URL from Google Sheet Apps Script below. Once saved, card inventory is retrieved and modified live on Google Sheets.
                </p>

                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 focus:border-purple-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition"
                />
                
                {isGlobalMode ? (
                  <span className="inline-flex items-center gap-1.5 mt-3 text-xs text-emerald-400 font-semibold">
                    <CheckCircle className="w-3.5 h-3.5" /> Database synced across all devices!
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 mt-3 text-xs text-amber-400 font-semibold">
                    <HelpCircle className="w-3.5 h-3.5" /> Operating in device-isolated local mode
                  </span>
                )}
              </div>

              {/* Paste Guide Container */}
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  How to Paste Your Table Into Google Sheets
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  You can now copy your MTG spreadsheet data (from Excel, ManaBox export, text file, etc.) and paste it directly into the first sheet named <strong className="text-slate-200">"Inventory"</strong> in Google Sheets.
                </p>

                <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-emerald-400">Copy Sheet Header Template:</span>
                    <button
                      onClick={copyHeaderToClipboard}
                      className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 font-bold"
                    >
                      {copiedHeader ? <Check className="w-3 h-3 text-emerald-400" /> : <Clipboard className="w-3 h-3" />}
                      {copiedHeader ? "Copied Headers!" : "Copy Headers Row"}
                    </button>
                  </div>
                  <code className="text-[11px] block bg-slate-950 text-slate-300 p-2.5 rounded font-mono select-all overflow-x-auto whitespace-nowrap">
                    Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,Scryfall ID,Purchase price
                  </code>
                </div>

                <div className="text-xs text-slate-400 space-y-1.5 list-disc pl-1">
                  <p>• Make sure the very first row of your Google Sheet has these exact column names.</p>
                  <p>• You can paste your columns in any order. The script dynamically maps headers.</p>
                  <p>• Once pasted in Sheets, click <strong className="text-slate-300">"Sync Sheet"</strong> in the main header to instantly load all changes live on the website.</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Info className="w-4 h-4 text-purple-400" />
                  Step-by-step cross-device setup guide:
                </h4>

                <div className="space-y-3 text-xs text-slate-400 leading-relaxed">
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60 flex gap-3">
                    <span className="font-extrabold text-purple-400 bg-purple-950/40 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">1</span>
                    <div>
                      <strong className="text-slate-200 block mb-0.5">Initialize Spreadsheet</strong>
                      Go to <a href="https://sheets.new" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">sheets.new</a> and create a blank spreadsheet. Name the first sheet tab <strong className="text-slate-200">"Inventory"</strong>.
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60 flex gap-3">
                    <span className="font-extrabold text-purple-400 bg-purple-950/40 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">2</span>
                    <div>
                      <strong className="text-slate-200 block mb-0.5">Copy Code &amp; Deploy</strong>
                      Click on <strong className="text-slate-300">Extensions &gt; Apps Script</strong> inside Sheets, paste the code below, and select <strong className="text-slate-300">Deploy &gt; New Deployment</strong>. Choose <strong className="text-slate-300">Web App</strong>, change Who Has Access to <strong className="text-slate-300">Anyone</strong>, and authorize it.
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60 flex gap-3">
                    <span className="font-extrabold text-purple-400 bg-purple-950/40 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">3</span>
                    <div>
                      <strong className="text-slate-200 block mb-0.5">Ready for Sync!</strong>
                      Copy the Web App URL from the deployment and paste it in the field above. Now simply paste your tables into your sheet and click Sync!
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Apps Script Database Code</label>
                  <button
                    type="button"
                    onClick={copyScriptToClipboard}
                    className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 font-semibold transition"
                  >
                    {copiedScript ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Clipboard className="w-3.5 h-3.5" />
                        <span>Copy Script Code</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="relative">
                  <pre className="bg-slate-950 text-[10px] text-slate-300 font-mono p-4 rounded-xl border border-slate-800 overflow-x-auto max-h-48 leading-relaxed">
                    {googleAppsScriptCode}
                  </pre>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm transition"
              >
                Close Settings
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-500 text-xs space-y-3">
          <p>
            Planeswalker Bazaar is unofficial Magic: The Gathering Fan Content permitted under the Fan Content Policy.
          </p>
          <p>
            Powered by the official Scryfall MTG Database API. All card inventory parsed and synced live directly from your Google Sheets.
          </p>
          <p className="text-slate-600">
            © {new Date().getFullYear()} Planeswalker Bazaar. Built for Magic Enthusiasts.
          </p>
        </div>
      </footer>
    </div>
  );
}
