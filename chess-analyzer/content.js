// Chess.com Analyzer - Content Script

// Injecter le CSS
const style = document.createElement('style');
style.textContent = `
#chess-analyzer-panel {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 280px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  z-index: 10000;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: white;
  transition: all 0.3s ease;
}

#chess-analyzer-panel.minimized .analyzer-content {
  display: none;
}

.analyzer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  cursor: move;
}

.analyzer-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

#toggle-analyzer {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

#toggle-analyzer:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.analyzer-content {
  padding: 20px;
}

.best-move-section,
.evaluation-section,
.depth-section,
.status-section {
  margin-bottom: 15px;
}

.label {
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 5px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.best-move {
  background: rgba(255, 255, 255, 0.15);
  padding: 12px;
  border-radius: 8px;
  font-size: 20px;
  font-weight: bold;
  text-align: center;
  letter-spacing: 2px;
  transition: all 0.3s;
}

.best-move.highlight {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.evaluation {
  background: rgba(255, 255, 255, 0.15);
  padding: 10px;
  border-radius: 8px;
  font-size: 18px;
  font-weight: bold;
  text-align: center;
  transition: all 0.3s;
}

.evaluation.positive {
  background: rgba(76, 175, 80, 0.3);
}

.evaluation.negative {
  background: rgba(244, 67, 54, 0.3);
}

.evaluation.neutral {
  background: rgba(255, 255, 255, 0.15);
}

.depth {
  background: rgba(255, 255, 255, 0.15);
  padding: 8px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  text-align: center;
}

.status {
  background: rgba(255, 255, 255, 0.1);
  padding: 8px 12px;
  border-radius: 20px;
  font-size: 13px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

#chess-analyzer-panel:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.4);
}
`;
document.head.appendChild(style);

class ChessAnalyzer {
  constructor() {
    this.board = null;
    this.currentFEN = '';
    this.stockfish = null;
    this.initStockfish();
    this.createUI();
    this.observeBoard();
  }

  initStockfish() {
    console.log('🚀 Initialisation de Stockfish...');
    
    // Essayer d'abord l'API Lichess pour les ouvertures
    this.analysisAPI = 'https://lichess.org/api/cloud-eval';
    this.useStockfish = false;
    
    // Charger Stockfish en Web Worker
    try {
      const stockfishPath = chrome.runtime.getURL('stockfish.js');
      console.log('📂 Chargement de Stockfish depuis:', stockfishPath);
      
      this.stockfish = new Worker(stockfishPath);
      this.stockfishReady = false;
      
      this.stockfish.onmessage = (event) => {
        const line = event.data;
        console.log('Stockfish:', line);
        
        if (line.includes('uciok')) {
          console.log('✅ Stockfish UCI OK');
          this.stockfish.postMessage('setoption name Threads value 2');
          this.stockfish.postMessage('setoption name Hash value 128');
          this.stockfish.postMessage('setoption name Skill Level value 20');
          this.stockfish.postMessage('isready');
        } else if (line.includes('readyok')) {
          console.log('✅ Stockfish prêt!');
          this.stockfishReady = true;
          this.updateStatus('🟢 Stockfish prêt');
        } else if (line.includes('bestmove')) {
          const parts = line.split(' ');
          const bestMove = parts[1];
          console.log('🎯 Meilleur coup Stockfish:', bestMove);
          this.displayBestMove(bestMove);
          this.updateStatus('🟢 Analyse terminée');
        } else if (line.includes('info') && line.includes('depth')) {
          this.parseStockfishInfo(line);
        }
      };
      
      this.stockfish.onerror = (error) => {
        console.error('❌ Erreur Stockfish:', error);
        this.stockfishReady = false;
      };
      
      // Initialiser Stockfish
      this.stockfish.postMessage('uci');
      
    } catch (error) {
      console.error('❌ Impossible de charger Stockfish:', error);
      this.updateStatus('⚠️ Stockfish non disponible');
    }
  }
  
  parseStockfishInfo(line) {
    // Extraire la profondeur
    const depthMatch = line.match(/depth (\d+)/);
    if (depthMatch) {
      document.getElementById('depth').textContent = depthMatch[1];
    }
    
    // Extraire l'évaluation
    const cpMatch = line.match(/score cp (-?\d+)/);
    const mateMatch = line.match(/score mate (-?\d+)/);
    
    if (cpMatch) {
      const score = parseInt(cpMatch[1]) / 100;
      this.displayEvaluation(score);
    } else if (mateMatch) {
      const mateIn = parseInt(mateMatch[1]);
      this.displayEvaluation(`Mat en ${Math.abs(mateIn)}`, mateIn > 0);
    }
  }

  createUI() {
    const panel = document.createElement('div');
    panel.id = 'chess-analyzer-panel';
    panel.innerHTML = `
      <div class="analyzer-header">
        <h3>♟️ Analyseur</h3>
        <button id="toggle-analyzer">●</button>
      </div>
      <div class="analyzer-content">
        <div class="best-move-section">
          <div class="label">Meilleur coup:</div>
          <div id="best-move" class="best-move">En attente...</div>
        </div>
        <div class="evaluation-section">
          <div class="label">Évaluation:</div>
          <div id="evaluation" class="evaluation">0.0</div>
        </div>
        <div class="depth-section">
          <div class="label">Profondeur:</div>
          <div id="depth" class="depth">0</div>
        </div>
        <div class="status-section">
          <div id="status" class="status">⚪ Inactif</div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // Toggle panel
    document.getElementById('toggle-analyzer').addEventListener('click', () => {
      panel.classList.toggle('minimized');
    });
  }

  observeBoard() {
    console.log('🔍 Démarrage de l\'observation de l\'échiquier...');
    
    // Attendre que l'échiquier soit chargé
    const waitForBoard = setInterval(() => {
      // Recherche de différents sélecteurs possibles pour l'échiquier
      const board = document.querySelector('.board') || 
                    document.querySelector('[class*="board"]') ||
                    document.querySelector('chess-board') ||
                    document.querySelector('wc-chess-board');
      
      if (board) {
        console.log('✅ Échiquier trouvé!', board);
        clearInterval(waitForBoard);
        
        // Observer les changements
        const observer = new MutationObserver(() => {
          this.checkBoardState();
        });

        observer.observe(board, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true
        });
        
        // Vérification périodique toutes les 2 secondes
        setInterval(() => {
          this.checkBoardState();
        }, 2000);
        
        // Première vérification immédiate
        this.checkBoardState();
      } else {
        console.log('⏳ Échiquier non trouvé, nouvelle tentative...');
      }
    }, 1000);
  }

  checkBoardState() {
    try {
      const fen = this.extractFEN();
      console.log('FEN extrait:', fen);
      
      if (fen && fen !== this.currentFEN && fen !== 'position initiale') {
        console.log('✅ Nouvelle position détectée!');
        this.currentFEN = fen;
        this.analyzeFEN(fen);
        this.updateStatus('🟢 Analyse en cours...');
      } else if (!fen) {
        console.log('⚠️ Impossible d\'extraire le FEN');
      }
    } catch (e) {
      console.error('❌ Erreur extraction FEN:', e);
    }
  }

  extractFEN() {
    console.log('🔍 Tentative d\'extraction du FEN...');
    
    // Méthode 1: Essayer d'accéder à l'objet global de Chess.com
    if (typeof window.chessGame !== 'undefined') {
      try {
        const fen = window.chessGame.getFEN();
        console.log('✅ FEN via chessGame:', fen);
        return fen;
      } catch (e) {
        console.log('❌ Échec chessGame');
      }
    }
    
    // Méthode 2: Via les données de l'échiquier
    const boardData = document.querySelector('[data-fen]');
    if (boardData) {
      const fen = boardData.getAttribute('data-fen');
      console.log('✅ FEN via data-fen:', fen);
      return fen;
    }
    
    // Méthode 3: Via chess-board component
    const chessBoard = document.querySelector('chess-board, wc-chess-board');
    if (chessBoard) {
      const fen = chessBoard.getAttribute('fen') || chessBoard.getAttribute('data-fen');
      if (fen) {
        console.log('✅ FEN via chess-board:', fen);
        return fen;
      }
    }
    
    // Méthode 4: Extraction visuelle améliorée
    console.log('🔍 Tentative d\'extraction visuelle...');
    return this.extractFENVisually();
  }

  extractFENVisually() {
    // Chercher toutes les pièces avec différents sélecteurs
    let pieces = document.querySelectorAll('.piece, [class*="piece"]');
    console.log(`📍 ${pieces.length} éléments "piece" trouvés au total`);
    
    // Filtrer pour ne garder que les pièces sur l'échiquier
    pieces = Array.from(pieces).filter(piece => {
      // Vérifier que la pièce est bien dans une case de l'échiquier
      const parent = piece.closest('[class*="square"]');
      if (!parent) return false;
      
      // Vérifier que la pièce est visible (pas capturée)
      const style = window.getComputedStyle(piece);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      
      // Vérifier que c'est bien dans l'échiquier principal
      const board = piece.closest('.board, [class*="board"]');
      if (!board) return false;
      
      return true;
    });
    
    console.log(`📍 ${pieces.length} pièces sur l'échiquier après filtrage`);
    
    if (pieces.length === 0) {
      console.log('⚠️ Aucune pièce trouvée');
      return null;
    }
    
    if (pieces.length > 32) {
      console.log('⚠️ Trop de pièces, tentative de filtrage supplémentaire...');
      // Garder seulement les 32 premières si nécessaire
      pieces = pieces.slice(0, 32);
    }

    const board = Array(8).fill(null).map(() => Array(8).fill(''));
    let piecesPlaced = 0;
    
    pieces.forEach((piece, index) => {
      try {
        const classes = piece.className;
        console.log(`Pièce ${index}:`, classes);
        
        // Extraire le type et la couleur de la pièce
        let color = null;
        let type = null;
        
        // Détection de la couleur (w = blanc, b = noir)
        if (classes.match(/\bw[a-z]/i) || classes.includes('white')) color = 'w';
        else if (classes.match(/\bb[a-z]/i) || classes.includes('black')) color = 'b';
        
        // Détection du type de pièce
        if (classes.match(/\b[wb]?p\b/i) || classes.includes('pawn')) type = 'p';
        else if (classes.match(/\b[wb]?r\b/i) || classes.includes('rook')) type = 'r';
        else if (classes.match(/\b[wb]?n\b/i) || classes.includes('knight')) type = 'n';
        else if (classes.match(/\b[wb]?b\b/i) || classes.includes('bishop')) type = 'b';
        else if (classes.match(/\b[wb]?q\b/i) || classes.includes('queen')) type = 'q';
        else if (classes.match(/\b[wb]?k\b/i) || classes.includes('king')) type = 'k';
        
        if (!color || !type) {
          console.log('⚠️ Impossible de déterminer type/couleur pour:', classes);
          return;
        }
        
        // Trouver la position sur l'échiquier
        const parent = piece.closest('[class*="square"]');
        if (parent) {
          const squareClass = parent.className;
          console.log('Case:', squareClass);
          
          // Extraire les coordonnées (ex: square-11, square-18, etc.)
          const match = squareClass.match(/square-?(\d)(\d)/);
          if (match) {
            let file = parseInt(match[1]) - 1;
            let rank = 8 - parseInt(match[2]);
            
            if (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
              const pieceChar = color === 'w' ? type.toUpperCase() : type.toLowerCase();
              board[rank][file] = pieceChar;
              piecesPlaced++;
              console.log(`✅ Pièce placée: ${pieceChar} en (${file},${rank})`);
            }
          }
        }
      } catch (e) {
        console.error('Erreur traitement pièce:', e);
      }
    });

    console.log(`📊 Total pièces placées: ${piecesPlaced}`);
    
    if (piecesPlaced < 2) {
      console.log('❌ Pas assez de pièces placées');
      return null;
    }

    return this.boardToFEN(board);
  }

  getPieceChar(color, type) {
    const pieceMap = {
      'wp': 'P', 'wn': 'N', 'wb': 'B', 'wr': 'R', 'wq': 'Q', 'wk': 'K',
      'bp': 'p', 'bn': 'n', 'bb': 'b', 'br': 'r', 'bq': 'q', 'bk': 'k'
    };
    return pieceMap[color.slice(0, 1) + type.slice(-1)] || '';
  }

  boardToFEN(board) {
    let fen = '';
    let emptyCount = 0;
    
    for (let rank = 0; rank < 8; rank++) {
      emptyCount = 0;
      for (let file = 0; file < 8; file++) {
        if (board[rank][file] === '') {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            fen += emptyCount;
            emptyCount = 0;
          }
          fen += board[rank][file];
        }
      }
      if (emptyCount > 0) fen += emptyCount;
      if (rank < 7) fen += '/';
    }
    
    // Retourner une position FEN simplifiée
    const fullFEN = fen + ' w KQkq - 0 1';
    console.log('📋 FEN généré:', fullFEN);
    
    // Vérifier si c'est une position valide (au moins un roi de chaque couleur)
    if (!fen.includes('K') || !fen.includes('k')) {
      console.log('❌ Position invalide (rois manquants)');
      return null;
    }
    
    return fullFEN;
  }

  analyzeFEN(fen) {
    // Analyse via API Lichess
    console.log('📤 Envoi à Lichess:', fen);
    this.updateStatus('🔍 Analyse en cours...');
    
    fetch(`${this.analysisAPI}?fen=${encodeURIComponent(fen)}&multiPv=1`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })
    .then(response => {
      console.log('📥 Réponse reçue, status:', response.status);
      if (response.status === 404) {
        console.log('⚠️ Position non trouvée dans le cloud, tentative analyse locale...');
        this.useLocalAnalysis(fen);
        return null;
      }
      return response.json();
    })
    .then(data => {
      if (!data) return; // Déjà géré par le 404
      
      console.log('✅ Données Lichess:', data);
      
      if (data.pvs && data.pvs.length > 0) {
        const bestLine = data.pvs[0];
        
        // Meilleur coup
        if (bestLine.moves) {
          const moves = bestLine.moves.split(' ');
          console.log('🎯 Meilleur coup:', moves[0]);
          this.displayBestMove(moves[0]);
        }
        
        // Évaluation
        if (bestLine.cp !== undefined) {
          // Centipawns
          const eval_score = bestLine.cp / 100;
          console.log('📊 Évaluation:', eval_score);
          this.displayEvaluation(eval_score);
        } else if (bestLine.mate !== undefined) {
          // Mat en X coups
          console.log('♔ Mat en:', bestLine.mate);
          this.displayEvaluation(`Mat en ${Math.abs(bestLine.mate)}`, bestLine.mate > 0);
        }
        
        // Profondeur
        if (data.depth) {
          console.log('🔢 Profondeur:', data.depth);
          document.getElementById('depth').textContent = data.depth;
        }
        
        this.updateStatus('🟢 Analyse terminée');
      } else if (data.error) {
        console.log('⚠️ Erreur API:', data.error);
        this.useLocalAnalysis(fen);
      } else {
        console.log('⚠️ Aucune analyse dans la réponse');
        this.useLocalAnalysis(fen);
      }
    })
    .catch(error => {
      console.error('❌ Erreur API Lichess:', error);
      this.useLocalAnalysis(fen);
    });
  }
  
  useLocalAnalysis(fen) {
    // Analyse basique locale quand l'API échoue
    console.log('🔧 Utilisation de l\'analyse locale basique');
    this.updateStatus('🟡 Analyse basique...');
    
    const moves = this.generateBasicMoves(fen);
    
    if (moves.length > 0) {
      // Choisir un coup aléatoire parmi les meilleurs
      const randomMove = moves[Math.floor(Math.random() * Math.min(3, moves.length))];
      this.displayBestMove(randomMove);
      this.displayEvaluation(0.0); // Évaluation neutre
      document.getElementById('depth').textContent = 'Local';
      this.updateStatus('🟡 Analyse locale');
    } else {
      this.displayBestMove('N/A');
      this.updateStatus('⚠️ Position complexe');
    }
  }
  
  generateBasicMoves(fen) {
    // Génération de coups basiques selon les principes d'échecs
    const suggestions = [];
    
    // Parser le FEN pour savoir qui joue
    const parts = fen.split(' ');
    const position = parts[0];
    const turn = parts[1] || 'w';
    
    // Suggestions génériques intelligentes selon la phase de jeu
    if (this.isOpeningPhase(position)) {
      // Ouverture : contrôle du centre
      suggestions.push('e2e4', 'd2d4', 'g1f3', 'b1c3', 'c2c4', 'e7e5', 'd7d5', 'g8f6');
    } else if (this.isEndgamePhase(position)) {
      // Finale : activation du roi
      suggestions.push('e1e2', 'e1f2', 'e8e7', 'e8f7', 'a2a4', 'h2h4');
    } else {
      // Milieu de jeu : développement et tactiques
      suggestions.push('f1e2', 'f8e7', 'b1c3', 'b8c6', 'c1f4', 'c8f5');
    }
    
    return suggestions;
  }
  
  isOpeningPhase(position) {
    // Détection simple : beaucoup de pièces sur le plateau
    const pieces = position.replace(/[/\d]/g, '');
    return pieces.length > 24;
  }
  
  isEndgamePhase(position) {
    // Détection simple : peu de pièces sur le plateau
    const pieces = position.replace(/[/\d]/g, '');
    return pieces.length < 12;
  }

  displayBestMove(move) {
    const elem = document.getElementById('best-move');
    if (elem) {
      elem.textContent = this.formatMove(move);
      elem.classList.add('highlight');
      setTimeout(() => elem.classList.remove('highlight'), 500);
    }
  }
  
  displayEvaluation(score, isMate = false) {
    const elem = document.getElementById('evaluation');
    if (elem) {
      if (typeof score === 'string') {
        // C'est un mat
        elem.textContent = score;
        elem.className = 'evaluation ' + (isMate ? 'positive' : 'negative');
      } else {
        // C'est un score en centipawns
        elem.textContent = (score > 0 ? '+' : '') + score.toFixed(2);
        elem.className = 'evaluation ' + (score > 0.5 ? 'positive' : score < -0.5 ? 'negative' : 'neutral');
      }
    }
  }

  formatMove(move) {
    if (!move || move.length < 4) return 'N/A';
    const from = move.substring(0, 2);
    const to = move.substring(2, 4);
    return `${from} → ${to}`;
  }

  updateAnalysis(msg) {
    // Cette méthode n'est plus utilisée avec l'API Lichess
    // Gardée pour compatibilité
  }

  updateStatus(text) {
    const elem = document.getElementById('status');
    if (elem) elem.textContent = text;
  }
}

// Initialiser l'analyseur
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ChessAnalyzer();
  });
} else {
  new ChessAnalyzer();
}