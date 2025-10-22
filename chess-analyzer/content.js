// Chess.com Analyzer - Content Script (Version propre)

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
    this.analysisCache = new Map();
    this.playerColor = null; // 'w' ou 'b'
    this.lastAnalyzedTurn = null; // Pour éviter d'analyser plusieurs fois le même tour
    this.waitingForOpponent = false;
    this.initStockfish();
    this.createUI();
    this.observeBoard();
  }

  initStockfish() {
    console.log('🚀 Initialisation via Background Worker...');
    this.updateStatus('🟢 Système prêt');
    console.log('✅ Utilisation du Service Worker (pas de CORS!)');
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
        <div id="color-selector" style="margin-bottom: 15px; text-align: center;">
          <div style="font-size: 12px; margin-bottom: 8px; opacity: 0.8;">Votre couleur :</div>
          <button id="select-white" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 15px; border-radius: 5px; cursor: pointer; margin: 0 5px; transition: all 0.2s;">♙ Blancs</button>
          <button id="select-black" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 15px; border-radius: 5px; cursor: pointer; margin: 0 5px; transition: all 0.2s;">♟️ Noirs</button>
        </div>
        <div class="best-move-section">
          <div class="label">Meilleur coup:</div>
          <div id="best-move" class="best-move">Sélectionnez couleur</div>
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
          <div id="status" class="status">❓ Choisissez votre couleur</div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    document.getElementById('toggle-analyzer').addEventListener('click', () => {
      panel.classList.toggle('minimized');
    });
    
    // Gestion des boutons de sélection de couleur
    const whiteBtn = document.getElementById('select-white');
    const blackBtn = document.getElementById('select-black');
    
    whiteBtn.addEventListener('click', () => {
      this.playerColor = 'w';
      console.log('♙ Blancs sélectionnés manuellement');
      whiteBtn.style.background = 'rgba(255,255,255,0.5)';
      blackBtn.style.background = 'rgba(255,255,255,0.2)';
      this.updateStatus('♙ Blancs - En attente du début');
      this.checkBoardState(); // Relancer la vérification
    });
    
    blackBtn.addEventListener('click', () => {
      this.playerColor = 'b';
      console.log('♟️ Noirs sélectionnés manuellement');
      blackBtn.style.background = 'rgba(255,255,255,0.5)';
      whiteBtn.style.background = 'rgba(255,255,255,0.2)';
      this.updateStatus('♟️ Noirs - En attente du début');
      this.checkBoardState(); // Relancer la vérification
    });
  }

  observeBoard() {
    console.log('🔍 Démarrage de l\'observation de l\'échiquier...');
    
    const waitForBoard = setInterval(() => {
      const board = document.querySelector('.board') || 
                    document.querySelector('[class*="board"]') ||
                    document.querySelector('chess-board') ||
                    document.querySelector('wc-chess-board');
      
      if (board) {
        console.log('✅ Échiquier trouvé!', board);
        clearInterval(waitForBoard);
        
        // Observer les changements avec configuration agressive
        const observer = new MutationObserver((mutations) => {
          // Vérifier immédiatement à chaque mutation
          this.checkBoardState();
        });

        observer.observe(board, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'style'], // Observer les changements de classes
          characterData: true
        });
        
        // Vérification périodique PLUS FRÉQUENTE (toutes les 500ms au lieu de 2s)
        setInterval(() => {
          this.checkBoardState();
        }, 500);
        
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
      
      if (!fen) {
        return;
      }
      
      // Vérifier si la couleur est sélectionnée
      if (this.playerColor === null) {
        return;
      }
      
      // Détecter un VRAI changement (pas juste une re-extraction du même FEN)
      if (fen === this.previousFEN) {
        return; // Rien n'a changé
      }
      
      // Un changement a été détecté !
      console.log('🔄 Changement détecté!');
      if (this.previousFEN) {
        console.log('📋 Ancien FEN:', this.previousFEN.substring(0, 50) + '...');
      }
      console.log('📋 Nouveau FEN:', fen.substring(0, 50) + '...');
      
      this.previousFEN = fen;
      
      // Extraire le tour depuis le FEN
      const fenParts = fen.split(' ');
      const turnColor = fenParts[1] || 'w';
      const fullMoveNumber = fenParts[5] || '1';
      
      console.log(`👤 Tour: ${turnColor === 'w' ? 'Blancs' : 'Noirs'} (coup ${fullMoveNumber})`);
      console.log(`🎮 Vous êtes: ${this.playerColor === 'w' ? 'Blancs' : 'Noirs'}`);
      
      if (turnColor === this.playerColor) {
        // C'est notre tour !
        console.log(`✅ C'est VOTRE tour!`);
        
        this.currentFEN = fen;
        this.waitingForOpponent = false;
        
        // Lancer l'analyse
        this.analyzeFEN(fen);
        this.updateStatus(`🎯 Votre tour (${this.playerColor === 'w' ? '♙' : '♟️'})`);
      } else {
        // Tour de l'adversaire
        console.log(`⏳ Tour de l'adversaire`);
        this.waitingForOpponent = true;
        this.updateStatus(`⏳ Tour adverse (${turnColor === 'w' ? '♙' : '♟️'})`);
        
        // Afficher "En attente..."
        const bestMoveElem = document.getElementById('best-move');
        if (bestMoveElem) {
          bestMoveElem.textContent = 'En attente...';
        }
      }
    } catch (e) {
      console.error('❌ Erreur checkBoardState:', e);
    }
  }
  
  detectPlayerColor() {
    const boardElement = document.querySelector('.board, [class*="board"]');
    if (!boardElement) {
      console.log('⚠️ Échiquier non trouvé');
      this.showColorSelector();
      return;
    }
    
    const classes = boardElement.className;
    console.log('🔍 Classes échiquier:', classes);
    
    // Méthode fiable: classe "flipped"
    if (classes.includes('flipped')) {
      this.playerColor = 'b';
      console.log('♟️ Noirs détectés (flipped)');
      this.updateStatus('♟️ Noirs');
      return;
    }
    
    // Si pas "flipped", probablement blancs
    if (classes.includes('board') && !classes.includes('flipped')) {
      this.playerColor = 'w';
      console.log('♙ Blancs détectés (pas flipped)');
      this.updateStatus('♙ Blancs');
      return;
    }
    
    // Sinon, demander à l'utilisateur
    console.log('⚠️ Détection auto impossible, demande manuelle');
    this.showColorSelector();
  }
  
  showColorSelector() {
    const selector = document.getElementById('color-selector');
    if (selector) {
      selector.style.display = 'block';
      this.updateStatus('❓ Choisissez votre couleur');
    }
  }

  extractFEN() {
    console.log('🔍 Tentative d\'extraction du FEN...');
    
    if (typeof window.chessGame !== 'undefined') {
      try {
        const fen = window.chessGame.getFEN();
        console.log('✅ FEN via chessGame:', fen);
        return fen;
      } catch (e) {
        console.log('❌ Échec chessGame');
      }
    }
    
    const boardData = document.querySelector('[data-fen]');
    if (boardData) {
      const fen = boardData.getAttribute('data-fen');
      console.log('✅ FEN via data-fen:', fen);
      return fen;
    }
    
    const chessBoard = document.querySelector('chess-board, wc-chess-board');
    if (chessBoard) {
      const fen = chessBoard.getAttribute('fen') || chessBoard.getAttribute('data-fen');
      if (fen) {
        console.log('✅ FEN via chess-board:', fen);
        return fen;
      }
    }
    
    console.log('🔍 Tentative d\'extraction visuelle...');
    return this.extractFENVisually();
  }

  extractFENVisually() {
    let pieces = document.querySelectorAll('.piece, [class*="piece"]');
    console.log(`📍 ${pieces.length} éléments "piece" trouvés au total`);
    
    pieces = Array.from(pieces).filter(piece => {
      const parent = piece.closest('[class*="square"]');
      if (!parent) return false;
      
      const style = window.getComputedStyle(piece);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      
      const board = piece.closest('.board, [class*="board"]');
      if (!board) return false;
      
      return true;
    });
    
    console.log(`📍 ${pieces.length} pièces sur l\'échiquier après filtrage`);
    
    if (pieces.length === 0) {
      console.log('⚠️ Aucune pièce trouvée');
      return null;
    }
    
    if (pieces.length > 32) {
      console.log('⚠️ Trop de pièces, filtrage...');
      pieces = pieces.slice(0, 32);
    }

    const board = Array(8).fill(null).map(() => Array(8).fill(''));
    let piecesPlaced = 0;
    
    pieces.forEach((piece, index) => {
      try {
        const classes = piece.className;
        console.log(`🔍 Pièce ${index}: classes="${classes}"`);
        
        let color = null;
        let type = null;
        
        // Détecter la couleur - AMÉLIORÉ
        if (classes.match(/\bw[a-z]/i) || classes.includes('white') || classes.includes('-w')) {
          color = 'w';
        } else if (classes.match(/\bb[a-z]/i) || classes.includes('black') || classes.includes('-b')) {
          color = 'b';
        }
        
        // Détecter le type - AMÉLIORÉ avec plus de patterns
        if (classes.match(/\b[wb]?p\b/i) || classes.includes('pawn') || classes.includes('-p')) {
          type = 'p';
        } else if (classes.match(/\b[wb]?r\b/i) || classes.includes('rook') || classes.includes('-r')) {
          type = 'r';
        } else if (classes.match(/\b[wb]?n\b/i) || classes.includes('knight') || classes.includes('-n')) {
          type = 'n';
        } else if (classes.match(/\b[wb]?b\b/i) || classes.includes('bishop') || classes.includes('-b')) {
          type = 'b';
        } else if (classes.match(/\b[wb]?q\b/i) || classes.includes('queen') || classes.includes('-q')) {
          type = 'q';
        } else if (classes.match(/\b[wb]?k\b/i) || classes.includes('king') || classes.includes('-k')) {
          type = 'k';
        }
        
        // Si on n'a pas trouvé, essayer avec le style background-image
        if (!type) {
          const style = window.getComputedStyle(piece);
          const bgImage = style.backgroundImage || '';
          console.log(`🖼️ Background image: ${bgImage}`);
          
          if (bgImage.includes('queen') || bgImage.includes('wq') || bgImage.includes('bq')) type = 'q';
          else if (bgImage.includes('king') || bgImage.includes('wk') || bgImage.includes('bk')) type = 'k';
          else if (bgImage.includes('rook') || bgImage.includes('wr') || bgImage.includes('br')) type = 'r';
          else if (bgImage.includes('bishop') || bgImage.includes('wb') || bgImage.includes('bb')) type = 'b';
          else if (bgImage.includes('knight') || bgImage.includes('wn') || bgImage.includes('bn')) type = 'n';
          else if (bgImage.includes('pawn') || bgImage.includes('wp') || bgImage.includes('bp')) type = 'p';
          
          if (bgImage.includes('/w') || bgImage.includes('white')) color = 'w';
          else if (bgImage.includes('/b') || bgImage.includes('black')) color = 'b';
        }
        
        if (!color || !type) {
          console.log(`❌ Impossible de déterminer: color=${color}, type=${type}`);
          return;
        }
        
        console.log(`✅ Détecté: ${color}${type}`);
        
        const parent = piece.closest('[class*="square"]');
        if (parent) {
          const squareClass = parent.className;
          
          const match = squareClass.match(/square-?(\d)(\d)/);
          if (match) {
            let file = parseInt(match[1]) - 1;
            let rank = 8 - parseInt(match[2]);
            
            if (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
              const pieceChar = color === 'w' ? type.toUpperCase() : type.toLowerCase();
              board[rank][file] = pieceChar;
              piecesPlaced++;
              console.log(`✅ Pièce placée: ${pieceChar} en ${String.fromCharCode(97 + file)}${8 - rank}`);
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
    
    const fullFEN = fen + ' w KQkq - 0 1';
    console.log('📋 FEN généré:', fullFEN);
    
    if (!fen.includes('K') || !fen.includes('k')) {
      console.log('❌ Position invalide (rois manquants)');
      return null;
    }
    
    return fullFEN;
  }

  async analyzeFEN(fen) {
    console.log('📤 Demande d\'analyse:', fen);
    
    if (this.analysisCache.has(fen)) {
      console.log('📦 Résultat en cache');
      const cached = this.analysisCache.get(fen);
      this.displayResult(cached);
      return;
    }
    
    this.updateStatus('🔍 Analyse...');
    
    try {
      const result = await chrome.runtime.sendMessage({
        action: 'analyzeFEN',
        fen: fen
      });
      
      if (result && !result.error) {
        console.log('✅ Résultat reçu du worker:', result);
        this.displayResult(result);
        this.analysisCache.set(fen, result);
      } else {
        console.log('⚠️ Pas de résultat API, analyse locale');
        // Extraire le tour depuis le FEN
        const fenParts = fen.split(' ');
        const turn = fenParts[1] || 'w';
        await this.improvedHeuristicAnalysis(fen, turn);
      }
    } catch (error) {
      console.log('⚠️ Worker non disponible, analyse locale');
      const fenParts = fen.split(' ');
      const turn = fenParts[1] || 'w';
      await this.improvedHeuristicAnalysis(fen, turn);
    }
  }

  displayResult(result) {
    this.displayBestMove(result.move);
    
    if (result.evaluation !== null && result.evaluation !== undefined) {
      this.displayEvaluation(result.evaluation);
    } else if (result.mate !== null && result.mate !== undefined) {
      this.displayEvaluation(`Mat en ${Math.abs(result.mate)}`, result.mate > 0);
    }
    
    if (result.source === 'cloud') {
      document.getElementById('depth').textContent = result.depth + ' 🌩️';
      this.updateStatus('🟢 Cloud Lichess');
    } else if (result.source === 'explorer') {
      document.getElementById('depth').textContent = result.games + '📚';
      this.updateStatus('🟢 DB Lichess');
    }
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
        elem.textContent = score;
        elem.className = 'evaluation ' + (isMate ? 'positive' : 'negative');
      } else {
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

  updateStatus(text) {
    const elem = document.getElementById('status');
    if (elem) elem.textContent = text;
  }

  // ============ ANALYSE HEURISTIQUE ============

  async analyzeWithOpeningBook(fen) {
    const openingBook = {
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR': ['e2e4', 'd2d4', 'g1f3', 'c2c4'],
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR': ['e7e5', 'c7c5', 'e7e6', 'c7c6'],
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR': ['g1f3', 'b1c3', 'f1c4'],
    };
    
    const position = fen.split(' ')[0];
    
    if (openingBook[position]) {
      const moves = openingBook[position];
      const bestMove = moves[0];
      
      this.displayBestMove(bestMove);
      this.displayEvaluation(0.2);
      document.getElementById('depth').textContent = '📖';
      this.updateStatus('🟢 Livre d\'ouvertures');
      
      return { move: bestMove, evaluation: 0.2, source: 'book' };
    }
    
    return null;
  }

  async improvedHeuristicAnalysis(fen, turn) {
    console.log('🧠 Analyse heuristique avancée');
    console.log(`📍 Tour: ${turn === 'w' ? 'Blancs' : 'Noirs'}`);
    
    const parts = fen.split(' ');
    const position = parts[0];
    
    const bookMove = await this.analyzeWithOpeningBook(fen);
    if (bookMove) {
      return bookMove;
    }
    
    const board = this.fenToBoard(position);
    const legalMoves = this.generateLegalMoves(board, turn);
    
    if (legalMoves.length === 0) {
      this.displayBestMove('Aucun coup');
      this.updateStatus('⚠️ Fin de partie');
      return null;
    }
    
    const evaluatedMoves = [];
    
    for (let move of legalMoves) {
      const score = this.evaluateMoveDeep(board, move, turn);
      evaluatedMoves.push({ move, score });
    }
    
    evaluatedMoves.sort((a, b) => b.score - a.score);
    
    const best = evaluatedMoves[0];
    const topMoves = evaluatedMoves.slice(0, 3);
    
    console.log('🎯 Top 3:', topMoves.map(m => `${m.move}(${m.score})`).join(', '));
    
    this.displayBestMove(best.move);
    
    const normalizedScore = Math.max(-5, Math.min(5, best.score / 100));
    this.displayEvaluation(normalizedScore);
    
    document.getElementById('depth').textContent = `${legalMoves.length}🧠`;
    this.updateStatus('🟡 Analyse tactique');
    
    return { move: best.move, evaluation: normalizedScore, source: 'tactical' };
  }

  fenToBoard(fen) {
    const rows = fen.split('/');
    const board = [];
    
    for (let row of rows) {
      const boardRow = [];
      for (let char of row) {
        if (char >= '1' && char <= '8') {
          for (let i = 0; i < parseInt(char); i++) {
            boardRow.push('');
          }
        } else {
          boardRow.push(char);
        }
      }
      board.push(boardRow);
    }
    
    return board;
  }

  generateLegalMoves(board, turn) {
    const moves = [];
    const isWhite = turn === 'w';
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (!piece) continue;
        
        const pieceIsWhite = piece === piece.toUpperCase();
        if (pieceIsWhite !== isWhite) continue;
        
        const pieceMoves = this.generatePieceMoves(board, row, col, piece.toLowerCase());
        
        // IMPORTANT : Filtrer les coups qui laissent le roi en échec
        for (let move of pieceMoves) {
          const testBoard = this.applyMove(board, move);
          
          // Vérifier si ce coup laisse notre roi en échec
          if (!this.isKingInCheck(testBoard, turn)) {
            moves.push(move);
          }
        }
      }
    }
    
    return moves;
  }
  
  isKingInCheck(board, kingColor) {
    // Trouver notre roi
    const ourKing = kingColor === 'w' ? 'K' : 'k';
    let kingRow = -1;
    let kingCol = -1;
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (board[row][col] === ourKing) {
          kingRow = row;
          kingCol = col;
          break;
        }
      }
      if (kingRow !== -1) break;
    }
    
    if (kingRow === -1) return false;
    
    // Vérifier si une pièce ennemie attaque notre roi
    const isWhite = kingColor === 'w';
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (!piece) continue;
        
        const pieceIsWhite = piece === piece.toUpperCase();
        if (pieceIsWhite === isWhite) continue; // C'est notre pièce
        
        // Vérifier si cette pièce ennemie attaque notre roi
        if (this.canAttack(board, row, col, kingRow, kingCol, piece.toLowerCase())) {
          return true;
        }
      }
    }
    
    return false;
  }

  generatePieceMoves(board, row, col, pieceType) {
    const moves = [];
    const fromSquare = this.coordsToSquare(col, row);
    
    switch (pieceType) {
      case 'p':
        moves.push(...this.generatePawnMoves(board, row, col));
        break;
      case 'n':
        moves.push(...this.generateKnightMoves(board, row, col));
        break;
      case 'b':
        moves.push(...this.generateBishopMoves(board, row, col));
        break;
      case 'r':
        moves.push(...this.generateRookMoves(board, row, col));
        break;
      case 'q':
        moves.push(...this.generateQueenMoves(board, row, col));
        break;
      case 'k':
        moves.push(...this.generateKingMoves(board, row, col));
        break;
    }
    
    return moves.map(to => fromSquare + to);
  }

  generatePawnMoves(board, row, col) {
    const moves = [];
    const piece = board[row][col];
    const isWhite = piece === piece.toUpperCase();
    const direction = isWhite ? -1 : 1;
    
    const newRow = row + direction;
    if (newRow >= 0 && newRow < 8 && !board[newRow][col]) {
      moves.push(this.coordsToSquare(col, newRow));
      
      const startRow = isWhite ? 6 : 1;
      if (row === startRow && !board[row + 2 * direction][col]) {
        moves.push(this.coordsToSquare(col, row + 2 * direction));
      }
    }
    
    for (let dcol of [-1, 1]) {
      const newCol = col + dcol;
      if (newCol >= 0 && newCol < 8 && newRow >= 0 && newRow < 8) {
        const target = board[newRow][newCol];
        if (target && (target === target.toUpperCase()) !== isWhite) {
          moves.push(this.coordsToSquare(newCol, newRow));
        }
      }
    }
    
    return moves;
  }

  generateKnightMoves(board, row, col) {
    const moves = [];
    const piece = board[row][col];
    const isWhite = piece === piece.toUpperCase();
    const deltas = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    
    for (let [dr, dc] of deltas) {
      const newRow = row + dr;
      const newCol = col + dc;
      
      if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
        const target = board[newRow][newCol];
        if (!target || (target === target.toUpperCase()) !== isWhite) {
          moves.push(this.coordsToSquare(newCol, newRow));
        }
      }
    }
    
    return moves;
  }

  generateBishopMoves(board, row, col) {
    return this.generateSlidingMoves(board, row, col, [[1,1],[1,-1],[-1,1],[-1,-1]]);
  }

  generateRookMoves(board, row, col) {
    return this.generateSlidingMoves(board, row, col, [[1,0],[-1,0],[0,1],[0,-1]]);
  }

  generateQueenMoves(board, row, col) {
    return this.generateSlidingMoves(board, row, col, [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]]);
  }

  generateKingMoves(board, row, col) {
    const moves = [];
    const piece = board[row][col];
    const isWhite = piece === piece.toUpperCase();
    
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        
        const newRow = row + dr;
        const newCol = col + dc;
        
        if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
          const target = board[newRow][newCol];
          if (!target || (target === target.toUpperCase()) !== isWhite) {
            moves.push(this.coordsToSquare(newCol, newRow));
          }
        }
      }
    }
    
    return moves;
  }

  generateSlidingMoves(board, row, col, directions) {
    const moves = [];
    const piece = board[row][col];
    const isWhite = piece === piece.toUpperCase();
    
    for (let [dr, dc] of directions) {
      let newRow = row + dr;
      let newCol = col + dc;
      
      while (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
        const target = board[newRow][newCol];
        
        if (!target) {
          moves.push(this.coordsToSquare(newCol, newRow));
        } else {
          if ((target === target.toUpperCase()) !== isWhite) {
            moves.push(this.coordsToSquare(newCol, newRow));
          }
          break;
        }
        
        newRow += dr;
        newCol += dc;
      }
    }
    
    return moves;
  }

  coordsToSquare(col, row) {
    const files = 'abcdefgh';
    return files[col] + (8 - row);
  }

  evaluateMoveDeep(board, move, turn) {
    let score = this.evaluateMove(board, move, turn);
    
    const newBoard = this.applyMove(board, move);
    const positionScore = this.evaluatePosition(newBoard, turn);
    
    score += positionScore;
    
    // Vérifier d'abord si c'est la Dame qui bouge
    const fromFile = move.charCodeAt(0) - 97;
    const fromRank = 8 - parseInt(move[1]);
    const piece = board[fromRank][fromFile];
    const toFile = move.charCodeAt(2) - 97;
    const toRank = 8 - parseInt(move[3]);
    
    // PROTECTION ABSOLUE : Si la Dame va sur une case dangereuse, annuler TOUS les bonus
    if (piece.toLowerCase() === 'q') {
      const isAttacked = this.isSquareAttacked(newBoard, toRank, toFile, turn === 'w' ? 'b' : 'w');
      const target = board[toRank][toFile];
      const pieceValues = { 'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 0 };
      const targetValue = target ? (pieceValues[target.toLowerCase()] || 0) : 0;
      
      if (isAttacked && targetValue < 900) {
        // Dame sur case attaquée pour capturer moins qu'une Dame = INTERDIT
        console.log(`🚫 VETO : Dame exposée pour gain insuffisant (${targetValue})`);
        return -10000; // Score catastrophique qui annule tout
      }
    }
    
    // Seulement maintenant, ajouter les bonus tactiques
    const tacticsScore = this.detectTactics(board, newBoard, move, turn);
    score += tacticsScore;
    
    return score;
  }

  applyMove(board, move) {
    const newBoard = board.map(row => [...row]);
    const fromFile = move.charCodeAt(0) - 97;
    const fromRank = 8 - parseInt(move[1]);
    const toFile = move.charCodeAt(2) - 97;
    const toRank = 8 - parseInt(move[3]);
    newBoard[toRank][toFile] = newBoard[fromRank][fromFile];
    newBoard[fromRank][fromFile] = '';
    return newBoard;
  }

  evaluatePosition(board, turn) {
    let score = 0;
    const pieceValues = { 'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 20000 };
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (!piece) continue;
        
        const value = pieceValues[piece.toLowerCase()] || 0;
        const isWhite = piece === piece.toUpperCase();
        
        if ((turn === 'w' && isWhite) || (turn === 'b' && !isWhite)) {
          score += value;
        } else {
          score -= value;
        }
        
        score += this.getPiecePositionBonus(piece, row, col);
      }
    }
    
    return score;
  }

  getPiecePositionBonus(piece, row, col) {
    const pieceType = piece.toLowerCase();
    const isWhite = piece === piece.toUpperCase();
    const distFromCenter = Math.abs(row - 3.5) + Math.abs(col - 3.5);
    let bonus = (7 - distFromCenter) * 2;
    
    if (pieceType === 'p') {
      bonus += isWhite ? (6 - row) * 5 : (row - 1) * 5;
    }
    
    if (pieceType === 'k') {
      bonus -= distFromCenter * 10;
    }
    
    return bonus;
  }

  detectTactics(oldBoard, newBoard, move, turn) {
    let tacticalBonus = 0;
    
    const toFile = move.charCodeAt(2) - 97;
    const toRank = 8 - parseInt(move[3]);
    
    // Détecter fourchettes
    const attacks = this.countAttacks(newBoard, toRank, toFile, turn);
    if (attacks >= 2) {
      tacticalBonus += 50 * attacks;
      console.log('🔱 Fourchette détectée!');
    }
    
    // Détecter échec
    if (this.isCheck(newBoard, turn)) {
      tacticalBonus += 40;
      console.log('♔ Échec détecté!');
      
      // Vérifier si c'est mat
      if (this.isCheckmate(newBoard, turn)) {
        tacticalBonus += 10000;
        console.log('♔♔♔ ÉCHEC ET MAT!');
      }
    }
    
    return tacticalBonus;
  }
  
  isCheckmate(board, turn) {
    // Vérifier que le roi est en échec
    if (!this.isCheck(board, turn)) return false;
    
    // Vérifier si l'adversaire peut s'échapper
    const enemyTurn = turn === 'w' ? 'b' : 'w';
    const enemyMoves = this.generateLegalMoves(board, enemyTurn);
    
    // Pour chaque coup possible de l'adversaire
    for (let move of enemyMoves) {
      const testBoard = this.applyMove(board, move);
      
      // Si après ce coup, le roi n'est plus en échec, ce n'est pas mat
      if (!this.isCheck(testBoard, turn)) {
        return false;
      }
    }
    
    // Aucun coup ne sauve le roi = mat!
    return true;
  }
  
  isCheck(board, turn) {
    // Trouver le roi ennemi
    const enemyKing = turn === 'w' ? 'k' : 'K';
    let kingRow = -1;
    let kingCol = -1;
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (board[row][col] === enemyKing) {
          kingRow = row;
          kingCol = col;
          break;
        }
      }
      if (kingRow !== -1) break;
    }
    
    if (kingRow === -1) return false;
    
    // Vérifier si une pièce alliée attaque le roi
    const isWhite = turn === 'w';
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (!piece) continue;
        
        const pieceIsWhite = piece === piece.toUpperCase();
        if (pieceIsWhite !== isWhite) continue;
        
        // Vérifier si cette pièce peut attaquer le roi
        if (this.canAttack(board, row, col, kingRow, kingCol, piece.toLowerCase())) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  canAttack(board, fromRow, fromCol, toRow, toCol, pieceType) {
    const dr = toRow - fromRow;
    const dc = toCol - fromCol;
    
    switch (pieceType) {
      case 'p': {
        const piece = board[fromRow][fromCol];
        const isWhite = piece === piece.toUpperCase();
        const direction = isWhite ? -1 : 1;
        return dr === direction && Math.abs(dc) === 1;
      }
      
      case 'n':
        return (Math.abs(dr) === 2 && Math.abs(dc) === 1) || 
               (Math.abs(dr) === 1 && Math.abs(dc) === 2);
      
      case 'b':
        if (Math.abs(dr) !== Math.abs(dc)) return false;
        return this.isPathClear(board, fromRow, fromCol, toRow, toCol);
      
      case 'r':
        if (dr !== 0 && dc !== 0) return false;
        return this.isPathClear(board, fromRow, fromCol, toRow, toCol);
      
      case 'q':
        if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return false;
        return this.isPathClear(board, fromRow, fromCol, toRow, toCol);
      
      case 'k':
        return Math.abs(dr) <= 1 && Math.abs(dc) <= 1;
      
      default:
        return false;
    }
  }
  
  isPathClear(board, fromRow, fromCol, toRow, toCol) {
    const dr = Math.sign(toRow - fromRow);
    const dc = Math.sign(toCol - fromCol);
    
    let r = fromRow + dr;
    let c = fromCol + dc;
    
    while (r !== toRow || c !== toCol) {
      if (board[r][c]) return false;
      r += dr;
      c += dc;
    }
    
    return true;
  }
  
  countAttacks(board, row, col, turn) {
    const piece = board[row][col];
    if (!piece) return 0;
    
    const pieceType = piece.toLowerCase();
    let attackCount = 0;
    
    const moves = this.generatePieceMoves(board, row, col, pieceType);
    
    for (let move of moves) {
      const targetFile = move.charCodeAt(0) - 97;
      const targetRank = 8 - parseInt(move[1]);
      const target = board[targetRank][targetFile];
      
      if (target && this.isValuablePiece(target)) {
        attackCount++;
      }
    }
    
    return attackCount;
  }
  
  isValuablePiece(piece) {
    const type = piece.toLowerCase();
    return ['n', 'b', 'r', 'q'].includes(type);
  }

  evaluateMove(board, move, turn) {
    const fromFile = move.charCodeAt(0) - 97;
    const fromRank = 8 - parseInt(move[1]);
    const toFile = move.charCodeAt(2) - 97;
    const toRank = 8 - parseInt(move[3]);
    
    let score = 0;
    
    const piece = board[fromRank][fromFile];
    const target = board[toRank][toFile];
    
    const pieceValues = { 'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 0 };
    
    // Évaluation de la capture avec SEE (Static Exchange Evaluation)
    if (target) {
      const captureValue = pieceValues[target.toLowerCase()] || 0;
      const attackerValue = pieceValues[piece.toLowerCase()] || 0;
      
      // Si on capture quelque chose de plus précieux, c'est bon
      score += captureValue;
      
      // Mais attention : vérifier si la case est défendue
      const isDefended = this.isSquareDefended(board, toRank, toFile, turn === 'w' ? 'b' : 'w');
      
      if (isDefended) {
        // La case est défendue, on risque de perdre notre pièce
        // Évaluer l'échange
        if (attackerValue > captureValue) {
          // Mauvais échange : on perd plus qu'on gagne
          score -= (attackerValue - captureValue) * 0.8; // Pénalité
          console.log(`⚠️ Mauvais échange : ${piece} (${attackerValue}) pour ${target} (${captureValue})`);
        } else if (attackerValue === captureValue) {
          // Échange égal
          score += 10; // Petit bonus pour simplifier
        } else {
          // Bon échange : on gagne plus qu'on perd
          score += 20;
        }
      } else {
        // Capture gratuite !
        score += 30;
        console.log(`✨ Capture gratuite : ${target}`);
      }
    }
    
    // Contrôle du centre
    const centerSquares = [[3,3],[3,4],[4,3],[4,4]];
    if (centerSquares.some(([r,c]) => r === toRank && c === toFile)) {
      score += 30;
    }
    
    // Développement
    const backRank = turn === 'w' ? 7 : 0;
    if (fromRank === backRank && ['n','b'].includes(piece.toLowerCase())) {
      score += 20;
    }
    
    // Avancer les pions centraux
    if (piece.toLowerCase() === 'p' && (toFile === 3 || toFile === 4)) {
      score += 15;
    }
    
    // Pénalité pour exposer des pièces précieuses
    if (['q', 'r'].includes(piece.toLowerCase())) {
      const isExposed = this.isSquareAttacked(board, toRank, toFile, turn === 'w' ? 'b' : 'w');
      if (isExposed) {
        score -= 40;
        console.log(`⚠️ Pièce précieuse exposée : ${piece}`);
      }
    }
    
    return score;
  }
  
  isSquareDefended(board, row, col, byColor) {
    // Vérifier si une case est défendue par une couleur
    const isWhite = byColor === 'w';
    
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece) continue;
        
        const pieceIsWhite = piece === piece.toUpperCase();
        if (pieceIsWhite !== isWhite) continue;
        
        if (this.canAttack(board, r, c, row, col, piece.toLowerCase())) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  isSquareAttacked(board, row, col, byColor) {
    // Alias pour isSquareDefended (plus clair sémantiquement)
    return this.isSquareDefended(board, row, col, byColor);
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