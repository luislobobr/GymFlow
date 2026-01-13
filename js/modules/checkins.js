/**
 * GymFlow - Check-ins Module
 * Manages daily check-ins, streaks, and shareable cards
 */

import { db, STORES } from '../database.js';

/**
 * Record a check-in for the day
 */
export async function recordCheckin(userId, durationMinutes, workoutId) {
    const date = new Date().toISOString().split('T')[0];

    // Check if already checked in today to update duration or just add new entry
    // For simplicity, we add a new entry. The weekly logic will sum them up.

    const checkin = {
        userId,
        date,
        durationMinutes,
        workoutId,
        timestamp: new Date().toISOString()
    };

    return await db.add(STORES.checkins, checkin);
}

/**
 * Get check-ins for the current week (Sunday to Saturday)
 */
export async function getWeeklyCheckins(userId) {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sun, 6 = Sat

    // Start of week (Sunday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    // Get all checkins for user
    const allCheckins = await db.getByIndex(STORES.checkins, 'userId', userId);

    // Filter for this week
    const weeklyCheckins = allCheckins.filter(c => {
        const d = new Date(c.date);
        // Fix timezone offset issue by comparing string YYYY-MM-DD? 
        // Or just simplifying since we store YYYY-MM-DD
        return new Date(c.date) >= startOfWeek;
    });

    // Map to days
    const weekData = Array(7).fill(null).map((_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];

        // Find checkins for this day
        const dayCheckins = weeklyCheckins.filter(c => c.date === dateStr);
        const totalDuration = dayCheckins.reduce((sum, c) => sum + (c.durationMinutes || 0), 0);

        return {
            date: dateStr,
            dayName: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][i],
            completed: dayCheckins.length > 0,
            duration: totalDuration,
            isToday: dateStr === today.toISOString().split('T')[0]
        };
    });

    return weekData;
}

/**
 * Get Streak count
 */
export async function getStreak(userId) {
    // We can reuse history logic or checkins logic. 
    // Let's use checkins logic to be independent.

    const allCheckins = await db.getByIndex(STORES.checkins, 'userId', userId);
    if (!allCheckins.length) return 0;

    // Unique dates sorted descending
    const dates = [...new Set(allCheckins.map(c => c.date))].sort().reverse();

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (!dates.includes(today) && !dates.includes(yesterday)) {
        return 0;
    }

    let streak = 0;
    let currentCheck = new Date();

    // If not checked in today yet, start checking from yesterday for streak calculation
    if (!dates.includes(today)) {
        currentCheck.setDate(currentCheck.getDate() - 1);
    }

    while (true) {
        const dateStr = currentCheck.toISOString().split('T')[0];
        if (dates.includes(dateStr)) {
            streak++;
            currentCheck.setDate(currentCheck.getDate() - 1);
        } else {
            break;
        }
    }

    return streak;
}

/**
 * Generate HTML/CSS for sharing
 */
export function generateShareableCard(weekData, userName) {
    const completedDays = weekData.filter(d => d.completed).length;
    const totalDuration = weekData.reduce((sum, d) => sum + d.duration, 0);

    // Returns HTML string to be injected into the modal
    return `
    <div class="share-card" id="share-card-node" style="
      background: linear-gradient(135deg, #1e293b, #0f172a);
      padding: 24px;
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.1);
      font-family: 'Inter', sans-serif;
      width: 100%;
      max-width: 400px;
      margin: 0 auto;
    ">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px;">
        <div>
          <h2 style="margin: 0; color: #fff; font-size: 1.5rem; font-weight: 800;">GymFlow</h2>
          <p style="margin: 4px 0 0; color: #94a3b8; font-size: 0.875rem;">Check-in Diário</p>
        </div>
        <div style="background: #10b981; color: #fff; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 1.25rem;">
          💪
        </div>
      </div>

      <div style="display: flex; gap: 8px; margin-bottom: 24px;">
        ${weekData.map(day => `
          <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;">
            <div style="
              width: 100%;
              aspect-ratio: 1;
              border-radius: 8px;
              background: ${day.completed ? '#10b981' : 'rgba(255,255,255,0.05)'};
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 0.75rem;
              color: ${day.completed ? 'white' : 'transparent'};
            ">
              ${day.completed ? '✓' : ''}
            </div>
            <span style="font-size: 0.65rem; color: #64748b; text-transform: uppercase;">${day.dayName[0]}</span>
          </div>
        `).join('')}
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 12px;">
          <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 4px;">Atleta</div>
          <div style="font-size: 1rem; color: white; font-weight: 600;">${userName}</div>
        </div>
        <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 12px;">
          <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 4px;">Foco da Semana</div>
          <div style="font-size: 1rem; color: #10b981; font-weight: 600;">${completedDays} treinos</div>
        </div>
      </div>
      
      <div style="margin-top: 20px; text-align: center; font-size: 0.75rem; color: #475569;">
        gymflow.app
      </div>
    </div>
  `;
}
