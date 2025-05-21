// Sistema de Pontuação
const SCORE_KEY = 'helloKittyTetrisScores';

function getScores() {
  const scores = localStorage.getItem(SCORE_KEY);
  return scores ? JSON.parse(scores) : [];
}

function saveScore(newScore) {
  const scores = getScores();
  scores.push(newScore);
  // Mantém apenas as 10 melhores pontuações
  const topScores = scores.sort((a, b) => b - a).slice(0, 10);
  localStorage.setItem(SCORE_KEY, JSON.stringify(topScores));
}

function showScores() {
  const scores = getScores();
  let scoresText = 'Top Pontuações:\n';
  
  if (scores.length === 0) {
    scoresText = 'Nenhuma pontuação registrada ainda!';
  } else {
    scores.forEach((score, index) => {
      scoresText += `${index + 1}. ${score} pontos\n`;
    });
  }
  
  showModal('scores', scoresText);
}

// Função para atualizar a pontuação (chame isso quando o jogo terminar)
function updateScore(score) {
  saveScore(score);
}

// Funções para controle dos modais

function showModal(modalType, content = '') {
  // Esconde todos os modais primeiro
  document.querySelectorAll('.modal').forEach(modal => {
    modal.classList.add('hidden');
  });
  
  // Mostra o modal específico
  const modal = document.getElementById(`${modalType}-modal`);
  if (modal) {
    // Atualiza o conteúdo se fornecido
    if (content) {
      const textElement = modal.querySelector('p');
      if (textElement) textElement.textContent = content;
    }
    modal.classList.remove('hidden');
  }
}

function hideModal() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.classList.add('hidden');
  });
}

// Funções específicas do jogo
function startGame() {
  window.location.href = "../html/game.html";
}

function showDedication() {
  const dedicationText = "Dedicado a uma pessoa muito especial que ama Hello Kitty 💕";
  showModal('dedication', dedicationText);
}

// Mantido para compatibilidade (pode ser removido depois de testar)
function hideExtra() {
  hideModal();
}