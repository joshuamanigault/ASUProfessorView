import styles from './content.styles.css?inline';
import { startProfessorCards } from './professor-cards.js';

if (!document.getElementById('rmp-card-styles')) {
    const style = document.createElement('style');
    style.id = 'rmp-card-styles';
    style.textContent = styles;
    document.head.appendChild(style);
}

startProfessorCards(document, chrome);
