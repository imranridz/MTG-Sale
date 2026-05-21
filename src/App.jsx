import React, { useState, useEffect, useMemo } from 'react';
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
  KeyRound
} from 'lucide-react';

const DEFAULT_CSV_DATA = `Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,Language,Purchase price currency,Added
Darkslick Shores,ONE,Phyrexia: All Will Be One,250,normal,rare,2,78812,bcbda15b-e49a-4445-a0e1-f221aa82c1e8,2.99,false,false,near_mint,en,USD,2025-10-05T14:38:01.559Z
Quicksilver Fisher,ONE,Phyrexia: All Will Be One,287,foil,common,4,78789,b394cdd1-a632-4b57-8356-4e2d9c9620f7,0.49,false,false,near_mint,en,USD,2025-10-05T14:38:01.559Z
Phyrexian Mite,TONE,Phyrexia: All Will Be One Tokens,12,normal,common,3,79059,a0b4b9cc-b0a4-4383-881b-e843e5d8a8c1,0.35,false,false,near_mint,en,USD,2025-10-05T14:38:01.559Z
Requiem Monolith,EOE,Edge of Eternities,113,normal,rare,1,107477,837d710a-652f-4c60-a52d-d786231160a4,0.49,false,false,near_mint,en,USD,2026-05-01T12:42:00.923Z
Fracture,STA,Strixhaven Mystical Archive,65,normal,rare,2,112588,34005b2e-6270-4ac3-9d35-021d916125ee,0.79,false,false,near_mint,en,USD,2026-05-01T12:42:00.924Z
Molten-Core Maestro,BIG,The Big Score,125,normal,rare,1,111697,326dfe32-3674-4a11-acd8-5ba62371235a,2.99,false,false,near_mint,en,USD,2026-05-01T12:42:00.924Z`;

export default function App() {
  const [cards, setCards] = useState(() => {
    const saved = localStorage.getItem('mtg_store_inventory');
    return saved ? JSON.parse(saved) : [];
  });
  const [scryfallData, setScryfallData] = useState({});
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState({});
  const [copiedScript, setCopiedScript] = useState(false);
  
  const [sheetUrl, setSheetUrl] = useState(() => {
    return localStorage.getItem('mtg_store_sheet_url') || '';
  });
  
  const [storedPasscode, setStoredPasscode] = useState(() => {
    return localStorage.getItem('mtg_store_owner_passcode') || '';
  });
  const [passcodeAttempt, setPasscodeAttempt] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [isPasscodePromptOpen, setIsPasscodePromptOpen] = useState(false);
  const [isPasscodeSetupOpen, setIsPasscodeSetupOpen] = useState(false);

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

  const normalizeHeaderKey = (key) => {
    return key.toLowerCase().trim().replace(/[\s_-]+/g, '');
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

  const parseCSV = (text) => {
    try {
      const lines = text.split(/\r?\n/);
      if (lines.length < 2) return [];
      
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const parsed = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        let row = [];
        let inQuotes = false;
        let currentField = '';
        
        for (let char of lines[i]) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            row.push(currentField.trim());
            currentField = '';
          } else {
            currentField += char;
          }
        }
        row.push(currentField.trim());

        if (row.length < headers.length) continue;

        const card = {};
        card.rowId = `card-row-${i}`;

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
      showToast('Error parsing CSV. Please check formatting.', 'error');
      return [];
    }
  };

  const showToast = (message, type = 'info') => {
    setAlertMsg({ message, type });
    setTimeout(() => {
      setAlertMsg(null);
    }, 4500);
  };

  useEffect(() => {
    if (cards.length === 0) {
      const defaultParsed = parseCSV(DEFAULT_CSV_DATA);
      setCards(defaultParsed);
      fetchScryfallDetails(defaultParsed);
    } else {
      fetchScryfallDetails(cards);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('mtg_store_inventory', JSON.stringify(cards));
  }, [cards]);

  useEffect(() => {
    localStorage.setItem('mtg_store_sheet_url', sheetUrl);
  }, [sheetUrl]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const parsed = parseCSV(text);
      if (parsed.length > 0) {
        setCards(parsed);
        setCart({});
        fetchScryfallDetails(parsed);
        showToast(`Successfully uploaded ${parsed.length} cards to inventory!`, 'success');
      } else {
        showToast('No valid MTG card rows found in the CSV file.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const fetchScryfallDetails = async (cardList) => {
    if (!cardList || cardList.length === 0) return;

    setLoading(true);
    const updatedDetails = { ...scryfallData };
    
    const identifiers = cardList.map(card => {
      if (card.scryfallid && card.scryfallid.trim() !== '') {
        return { id: card.scryfallid };
      } else if (card.name && card.setcode) {
        return { name: card.name, set: card.setcode.toLowerCase() };
      }
      return null;
    }).filter(Boolean);

    if (identifiers.length === 0) {
      setLoading(false);
      return;
    }

    const batchSize = 75;
    const batches = [];
    for (let i = 0; i < identifiers.length; i += batchSize) {
      batches.push(identifiers.slice(i, i + batchSize));
    }

    try {
      for (const batch of batches) {
        const response = await fetch('https://api.scryfall.com/cards/collection', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ identifiers: batch })
        });

        if (response.ok) {
          const result = await response.json();
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

                if (scryCard.id) {
                  updatedDetails[scryCard.id] = cardDetail;
                }
                const fallbackKey = `${scryCard.name?.toLowerCase()}-${scryCard.set?.toLowerCase()}`;
                updatedDetails[fallbackKey] = cardDetail;
              }
            });
          }
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      setScryfallData(updatedDetails);
    } catch (err) {
      console.error('Error contacting Scryfall API:', err);
      showToast('Some card images could not load from Scryfall.', 'warning');
    } finally {
      setLoading(false);
    }
  };

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

  const googleAppsScriptCode = `function doPost(e) {
  try {
    var jsonString = e.postData.contents;
    var data = JSON.parse(jsonString);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp", "Customer Name", "Phone Number", "Total Value", "Card Orders"]);
    }
    var ordersSummary = data.items.map(function(item) {
      return item.name + " (" + item.set + " #" + item.collectorNumber + ") [" + item.foil + "] x" + item.quantity;
    }).join(", ");
    sheet.appendRow([
      new Date(),
      data.buyerName,
      data.buyerPhone,
      "$" + data.totalValue.toFixed(2),
      ordersSummary
    ]);
    return ContentService.createTextOutput(JSON.stringify({ "status": "success", "message": "Order logged successfully!" }))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const copyScriptToClipboard = () => {
    navigator.clipboard.writeText(googleAppsScriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
    showToast('Apps Script code copied to clipboard!', 'success');
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

    setCards(updatedCards);
    localStorage.setItem('mtg_store_inventory', JSON.stringify(updatedCards));

    const payload = {
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
        price: parseFloat(item.card.purchaseprice) || 0
      }))
    };

    setSubmittingOrder(true);

    if (!sheetUrl) {
      setTimeout(() => {
        setSubmittingOrder(false);
        setOrderSubmitted(true);
        setCart({});
        showToast('Demo checkout successful! No Google Sheet Webhook URL was configured, so this was simulated.', 'info');
      }, 1500);
      return;
    }

    try {
      await fetch(sheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify(payload)
      });

      setSubmittingOrder(false);
      setOrderSubmitted(true);
      setCart({});
      showToast('Order submitted successfully directly to your Google Sheet!', 'success');
    } catch (error) {
      console.error(error);
      setSubmittingOrder(false);
      showToast('Error communicating with Google Sheets. Check your App URL configuration.', 'error');
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

      {}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-rose-500 to-purple-600 rounded-xl text-white shadow-md">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-rose-400 bg-clip-text text-transparent">
                Quitting Sale
              </h1>
              <p className="text-xs text-slate-400">Everything for sale</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSettingsClick}
              className="p-2.5 bg-slate-800 text-slate-300 hover:text-white rounded-xl transition duration-200 border border-slate-700/60 flex items-center gap-1.5"
              title="Store Owner Settings"
            >
              <Settings className="w-5 h-5" />
              <span className="text-xs font-semibold hidden md:inline">Admin</span>
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

      {}
      <section className="relative overflow-hidden bg-slate-900 py-12 border-b border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(244,63,94,0.1),transparent)]"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-950/50 text-rose-400 text-xs font-semibold rounded-full border border-rose-900/60 mb-4">
                <Sparkles className="w-3.5 h-3.5" /> Buyer &amp; Seller Platform
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3">
                Browse My Magic Card Inventory
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                Click on any card to add to cart. Submit with your name and telephone number, and I will contact you for confirmation.
              </p>
              <div className="space-y-1 mb-6 border-l-2 border-rose-500 pl-4 py-1">
                <p className="text-slate-300 text-sm font-semibold">1-4 cards: Subtotal x 2.5 RM</p>
                <p className="text-slate-300 text-sm font-semibold">5-9 cards: Subtotal x 2.3 RM</p>
                <p className="text-slate-300 text-sm font-semibold">10 or more cards: Subtotal x 2.0 RM</p>
              </div>
              <div className="text-xs text-slate-400">
                Currently showcasing <strong className="text-slate-200">{cards.length}</strong> unique listings
              </div>
            </div>
            
            <div className="bg-slate-950/60 p-6 rounded-2xl border border-slate-800/80 shadow-2xl relative">
              <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-rose-400" />
                How to Purchase
              </h3>
              <ol className="space-y-3 text-sm text-slate-400">
                <li className="flex gap-2">
                  <span className="flex-none font-bold text-rose-400 bg-rose-950/40 w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span>
                  <span>Use filters or search bar to track down specific rarities and colors.</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-none font-bold text-rose-400 bg-rose-950/40 w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>
                  <span>Click the cards you desire to add them to your cart. Sold items are grayed out.</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-none font-bold text-rose-400 bg-rose-950/40 w-5 h-5 rounded-full flex items-center justify-center text-xs">3</span>
                  <span>Open your cart, type in your delivery info, and checkout.</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {}
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

          {}
          <div className="flex-1">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-900">
              <h3 className="text-sm font-semibold text-slate-400">
                Showing <strong className="text-white">{filteredAndSortedCards.length}</strong> of {cards.length} cards
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
                  <div className="flex items-center gap-2 text-rose-400 text-xs ml-2">
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {filteredAndSortedCards.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl py-16 px-4 text-center">
                <Database className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h4 className="text-lg font-bold text-white mb-1">No Cards Found</h4>
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                  We couldn't find any cards matching your filters. Try clearing your settings or checking your search query.
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredAndSortedCards.map((card) => {
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
                            <span className="text-[10px] text-slate-500">Querying Scryfall...</span>
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
                          <div className="absolute inset-0 bg-rose-600/20 backdrop-blur-xs flex items-center justify-center z-15">
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
                            <button disabled className="px-3 py-1.5 bg-slate-950 text-slate-650 rounded-lg text-xs font-bold cursor-not-allowed border border-slate-800">
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
            )}

          </div>

        </div>
      </main>

      {}
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
                        Thank you! Your selections have been saved. If you connected a Google Sheet, your details are logged in the active ledger.
                      </p>
                      <button
                        onClick={() => setOrderSubmitted(false)}
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

      {}
      {isPasscodeSetupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsPasscodeSetupOpen(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
          <div className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 sm:p-8 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-purple-950/50 border border-purple-500 flex items-center justify-center text-purple-400 mb-4 animate-bounce">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-white mb-2">Create Admin Passcode</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Welcome! Since this is your first time accessing the Admin menu, please configure a custom secret passcode. Only you will be able to access settings and inventory uploads from this browser.
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

      {isPasscodePromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsPasscodePromptOpen(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
          <div className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 sm:p-8 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-950/50 border border-rose-500 flex items-center justify-center text-rose-400 mb-4">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-white mb-2">Storeowner Verification</h3>
            <p className="text-xs text-slate-400 mb-6">
              Enter your passcode to open settings and upload card databases.
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

      {}
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
                  <h3 className="font-extrabold text-xl text-white">Storeowner Settings</h3>
                  <p className="text-xs text-slate-400">Configure your target spreadsheet to save buyer details</p>
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
                <h4 className="text-sm font-bold text-slate-200 mb-1 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  Inventory Database
                </h4>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Upload a standard ManaBox, Scryfall, or custom formatted MTG card lists in `.csv` format to update stock details, quantities, and pricing.
                </p>
                
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-850 text-slate-200 text-xs font-semibold rounded-xl cursor-pointer transition border border-slate-800/80">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span>Upload New CSV File</span>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <span className="text-xs text-slate-500">
                    Currently tracking <strong className="text-slate-300">{cards.length}</strong> card items.
                  </span>
                </div>
              </div>

              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                <h4 className="text-sm font-bold text-slate-200 mb-2">Google Apps Script Web App URL</h4>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Provide your published deployment web app URL from Google Sheet Apps Script below. The system will dispatch checkout orders here instantly.
                </p>

                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 focus:border-purple-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition"
                />
                
                {sheetUrl ? (
                  <span className="inline-flex items-center gap-1.5 mt-3 text-xs text-emerald-400 font-semibold">
                    <CheckCircle className="w-3.5 h-3.5" /> Webhook is currently active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 mt-3 text-xs text-amber-400 font-semibold">
                    <HelpCircle className="w-3.5 h-3.5" /> Waiting for URL configuration
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Info className="w-4 h-4 text-purple-400" />
                  Quick setup instructions:
                </h4>

                <div className="space-y-3 text-xs text-slate-400 leading-relaxed">
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60 flex gap-3">
                    <span className="font-extrabold text-purple-400 bg-purple-950/40 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">1</span>
                    <div>
                      <strong className="text-slate-200 block mb-0.5">Create Spreadsheet</strong>
                      Go to <a href="https://sheets.new" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">sheets.new</a> and create a blank spreadsheet.
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60 flex gap-3">
                    <span className="font-extrabold text-purple-400 bg-purple-950/40 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">2</span>
                    <div>
                      <strong className="text-slate-200 block mb-0.5">Open Apps Script</strong>
                      Click on <strong className="text-slate-300">Extensions &gt; Apps Script</strong> inside Google Sheets, and replace all default editor code with the copied code block below.
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60 flex gap-3">
                    <span className="font-extrabold text-purple-400 bg-purple-950/40 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">3</span>
                    <div>
                      <strong className="text-slate-200 block mb-0.5">Deploy as Web App</strong>
                      Click <strong className="text-slate-300">Deploy &gt; New Deployment</strong>. Choose <strong className="text-slate-300">Web App</strong> as type. Change <strong className="text-slate-300">Who has access</strong> to <strong className="text-slate-300">Anyone</strong> (this is required for your client store to submit), authorize, and paste your generated URL above!
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Apps Script Code</label>
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

      {}
      <footer className="bg-slate-950 border-t border-slate-900 py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-500 text-xs space-y-3">
          <p>
            Planeswalker Bazaar is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards.
          </p>
          <p>
            Powered by the official Scryfall MTG Database API.
          </p>
          <p className="text-slate-600">
            © {new Date().getFullYear()} Planeswalker Bazaar. Built for Magic Enthusiasts.
          </p>
        </div>
      </footer>
    </div>
  );
}
