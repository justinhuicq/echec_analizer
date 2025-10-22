// Background Service Worker pour contourner CORS
console.log('🔧 Background Service Worker démarré');

// Écouter les messages du content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeFEN') {
    console.log('📥 Requête d\'analyse reçue:', request.fen);
    
    // Analyser en arrière-plan (pas de CORS ici !)
    analyzeFEN(request.fen).then(result => {
      console.log('📤 Résultat envoyé:', result);
      sendResponse(result);
    }).catch(error => {
      console.error('❌ Erreur analyse:', error);
      sendResponse({ error: error.message });
    });
    
    // Important : retourner true pour async
    return true;
  }
});

async function analyzeFEN(fen) {
  console.log('🔍 Analyse de:', fen);
  
  // Essayer Lichess Cloud
  try {
    const cloudResult = await tryLichessCloud(fen);
    if (cloudResult) return cloudResult;
  } catch (e) {
    console.log('⚠️ Cloud échoué:', e.message);
  }
  
  // Essayer Lichess Explorer
  try {
    const explorerResult = await tryLichessExplorer(fen);
    if (explorerResult) return explorerResult;
  } catch (e) {
    console.log('⚠️ Explorer échoué:', e.message);
  }
  
  // Retourner null pour analyse locale
  return null;
}

async function tryLichessCloud(fen) {
  console.log('🌩️ Cloud Lichess...');
  
  const response = await fetch(`https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=1`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });
  
  if (!response.ok) {
    console.log('❌ Cloud status:', response.status);
    return null;
  }
  
  const data = await response.json();
  
  if (data.pvs && data.pvs.length > 0) {
    const bestLine = data.pvs[0];
    
    return {
      move: bestLine.moves.split(' ')[0],
      evaluation: bestLine.cp !== undefined ? bestLine.cp / 100 : null,
      mate: bestLine.mate !== undefined ? bestLine.mate : null,
      depth: data.depth,
      source: 'cloud'
    };
  }
  
  return null;
}

async function tryLichessExplorer(fen) {
  console.log('📚 Explorer Lichess...');
  
  // Estimer le nombre de coups
  const position = fen.split(' ')[0];
  const pieces = position.replace(/[/\d]/g, '');
  const moveCount = Math.floor((32 - pieces.length) * 1.5);
  
  if (moveCount > 20) {
    console.log('⏩ Trop avancé pour Explorer');
    return null;
  }
  
  const response = await fetch(`https://explorer.lichess.ovh/lichess?fen=${encodeURIComponent(fen)}&topGames=0&recentGames=0`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });
  
  if (!response.ok) {
    console.log('❌ Explorer status:', response.status);
    return null;
  }
  
  const data = await response.json();
  
  if (data.moves && data.moves.length > 0) {
    // Trier par taux de victoire
    const sortedMoves = data.moves.sort((a, b) => {
      const scoreA = (a.white + a.draws * 0.5) / (a.white + a.draws + a.black || 1);
      const scoreB = (b.white + b.draws * 0.5) / (b.white + b.draws + b.black || 1);
      return scoreB - scoreA;
    });
    
    const bestMove = sortedMoves[0];
    const winRate = (bestMove.white + bestMove.draws * 0.5) / (bestMove.white + bestMove.draws + bestMove.black);
    const evalScore = (winRate - 0.5) * 4;
    
    return {
      move: bestMove.uci || bestMove.san,
      evaluation: evalScore,
      games: bestMove.white + bestMove.draws + bestMove.black,
      source: 'explorer'
    };
  }
  
  return null;
}