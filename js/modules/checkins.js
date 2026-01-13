/**
 * GymFlow - Check-ins Module
 * Daily workout tracking with weekly view and shareable cards
 */

import { db, STORES } from '../database.js';

// Add checkins store to database if not exists
const CHECKINS_STORE = 'checkins';

/**
 * Record a workout check-in
 * @param {string} userId - User ID
 * @param {number} durationMinutes - Workout duration in minutes
 * @param {number} workoutId - Associated workout ID
 * @returns {Promise<number>} Check-in ID
 */
export async function recordCheckin(userId, durationMinutes, workoutId = null) {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

    // Check if already has checkin for today
    const existing = await getCheckinByDate(userId, dateStr);

    if (existing) {
        // Update existing checkin (add duration)
        existing.durationMinutes += durationMinutes;
        existing.workoutIds = existing.workoutIds || [];
        if (workoutId) existing.workoutIds.push(workoutId);
        await db.update(CHECKINS_STORE, existing);
        return existing.id;
    }

    // Create new checkin
    const checkin = {
        userId,
        date: dateStr,
        durationMinutes,
        workoutIds: workoutId ? [workoutId] : [],
        createdAt: today.toISOString()
    };

    return await db.add(CHECKINS_STORE, checkin);
}

/**
 * Get check-in for a specific date
 */
async function getCheckinByDate(userId, dateStr) {
    const all = await db.getByIndex(CHECKINS_STORE, 'userId', userId);
    return all.find(c => c.date === dateStr);
}

/**
 * Get check-ins for current week (Mon-Sun)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Weekly check-ins data
 */
export async function getWeeklyCheckins(userId) {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday

    // Calculate Monday of current week
    const monday = new Date(today);
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    monday.setDate(today.getDate() - daysFromMonday);
    monday.setHours(0, 0, 0, 0);

    // Get all user check-ins
    const allCheckins = await db.getByIndex(CHECKINS_STORE, 'userId', userId);

    // Build week data
    const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const week = [];

    for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        const checkin = allCheckins.find(c => c.date === dateStr);
        const isToday = dateStr === today.toISOString().split('T')[0];
        const isPast = date < today && !isToday;

        week.push({
            dayName: weekDays[i],
            date: dateStr,
            shortDate: `${date.getDate()}/${date.getMonth() + 1}`,
            checked: !!checkin,
            durationMinutes: checkin?.durationMinutes || 0,
            isToday,
            isPast,
            isFuture: !isToday && !isPast
        });
    }

    // Calculate total duration for the week
    const totalMinutes = week.reduce((sum, day) => sum + day.durationMinutes, 0);
    const daysCompleted = week.filter(d => d.checked).length;

    return {
        week,
        totalMinutes,
        daysCompleted,
        streak: await getStreak(userId)
    };
}

/**
 * Calculate consecutive days streak
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of consecutive days
 */
export async function getStreak(userId) {
    const allCheckins = await db.getByIndex(CHECKINS_STORE, 'userId', userId);

    if (allCheckins.length === 0) return 0;

    // Sort by date descending
    const sorted = allCheckins
        .map(c => ({ ...c, dateObj: new Date(c.date) }))
        .sort((a, b) => b.dateObj - a.dateObj);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if most recent is today or yesterday
    const mostRecent = sorted[0].dateObj;
    mostRecent.setHours(0, 0, 0, 0);

    if (mostRecent < yesterday) {
        return 0; // Streak broken
    }

    // Count consecutive days
    let streak = 0;
    let checkDate = mostRecent.getTime() === today.getTime() ? today : yesterday;

    for (const checkin of sorted) {
        const checkinDate = new Date(checkin.date);
        checkinDate.setHours(0, 0, 0, 0);

        if (checkinDate.getTime() === checkDate.getTime()) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else if (checkinDate < checkDate) {
            break; // Gap in streak
        }
    }

    return streak;
}

/**
 * Generate shareable HTML card
 * @param {Object} weekData - Weekly check-ins data
 * @param {string} userName - User name for the card
 * @returns {string} HTML string
 */
export function generateShareableCard(weekData, userName) {
    const { week, totalMinutes, daysCompleted, streak } = weekData;

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const timeStr = hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;

    return `
    <div class="checkin-card" id="checkin-card">
      <div class="checkin-header">
        <div class="checkin-logo">💪 GymFlow</div>
        <div class="checkin-user">${userName}</div>
      </div>
      
      <div class="checkin-week">
        ${week.map(day => `
          <div class="checkin-day ${day.checked ? 'checked' : ''} ${day.isToday ? 'today' : ''}">
            <span class="day-name">${day.dayName}</span>
            <span class="day-icon">${day.checked ? '✅' : (day.isFuture ? '⬜' : '❌')}</span>
            ${day.durationMinutes > 0 ? `<span class="day-time">${day.durationMinutes}min</span>` : ''}
          </div>
        `).join('')}
      </div>
      
      <div class="checkin-stats">
        <div class="stat">
          <span class="stat-value">${daysCompleted}/7</span>
          <span class="stat-label">dias</span>
        </div>
        <div class="stat">
          <span class="stat-value">${timeStr}</span>
          <span class="stat-label">tempo total</span>
        </div>
        <div class="stat streak">
          <span class="stat-value">🔥 ${streak}</span>
          <span class="stat-label">sequência</span>
        </div>
      </div>
      
      <div class="checkin-footer">
        Semana de ${week[0].shortDate} a ${week[6].shortDate}
      </div>
    </div>
  `;
}

/**
 * Share or download the check-in card
 * @param {HTMLElement} cardElement - The card element to share
 */
export async function shareCheckinCard(cardElement) {
    try {
        // Use html2canvas if available, otherwise use Web Share API with text
        if (typeof html2canvas !== 'undefined') {
            const canvas = await html2canvas(cardElement, {
                backgroundColor: '#1a1a2e',
                scale: 2
            });

            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

            if (navigator.share && navigator.canShare({ files: [new File([blob], 'checkin.png', { type: 'image/png' })] })) {
                await navigator.share({
                    files: [new File([blob], 'gymflow-checkin.png', { type: 'image/png' })],
                    title: 'Meu Check-in GymFlow',
                    text: 'Confira meu progresso de treinos! 💪'
                });
            } else {
                // Fallback: download
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'gymflow-checkin.png';
                a.click();
                URL.revokeObjectURL(url);
            }
        } else {
            // Fallback without html2canvas
            if (navigator.share) {
                await navigator.share({
                    title: 'Meu Check-in GymFlow',
                    text: 'Estou mantendo minha rotina de treinos com o GymFlow! 💪🔥'
                });
            } else {
                alert('Compartilhamento não suportado neste navegador');
            }
        }
    } catch (error) {
        console.error('[Checkin] Share error:', error);
        throw error;
    }
}

export default {
    recordCheckin,
    getWeeklyCheckins,
    getStreak,
    generateShareableCard,
    shareCheckinCard
};
