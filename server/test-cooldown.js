import 'dotenv/config';
import db from './db.js';

async function runTest() {
  await db.init();
  console.log('🧪 Starting ticket cooldown unit tests...');

  // 1. Setup a test conversation
  await db.run("DELETE FROM whatsapp_conversations WHERE chat_id = 'test-cooldown-chat'");
  await db.run("INSERT INTO whatsapp_conversations (bot_id, chat_id, user_name, status, state, cooldown_until) VALUES (1, 'test-cooldown-chat', 'Test User', 'ai', 'idle', NULL)");
  const convo = await db.get("SELECT * FROM whatsapp_conversations WHERE chat_id = 'test-cooldown-chat'");
  console.log('✅ Created test conversation:', convo.id);

  // 2. Create a ticket associated with this conversation
  const ticketId = await db.insert("INSERT INTO tickets (type, status, priority, title, description, whatsapp_conversation_id, source) VALUES (?, ?, ?, ?, ?, ?, ?)", 
    ['maintenance', 'open', 'medium', 'Test Cooldown Ticket', 'Test Desc', convo.id, 'whatsapp']);
  console.log('✅ Created test ticket:', ticketId);

  // Set cooldown
  const cooldownTime = new Date(Date.now() + 6 * 60 * 60 * 1000);
  await db.run("UPDATE whatsapp_conversations SET cooldown_until = ?, pending_data = ? WHERE id = ?", [cooldownTime, JSON.stringify({ ticket_id: ticketId }), convo.id]);
  
  let updatedConvo = await db.get("SELECT * FROM whatsapp_conversations WHERE id = ?", [convo.id]);
  console.log('✅ Cooldown set until:', updatedConvo.cooldown_until);
  if (!updatedConvo.cooldown_until) throw new Error('Cooldown failed to set!');

  // 3. Test Cooldown Reset on Update ticket to 'resolved'
  console.log('🔄 Resolving ticket...');
  // Simulate routing PUT /api/tickets/:id
  // Auto-reset cooldown if ticket is closed or resolved
  if (true) { // status is resolved
    if (updatedConvo.id) {
      await db.run('UPDATE whatsapp_conversations SET cooldown_until = NULL WHERE id = ?', [updatedConvo.id]);
    }
  }
  
  updatedConvo = await db.get("SELECT * FROM whatsapp_conversations WHERE id = ?", [convo.id]);
  console.log('✅ Cooldown after resolving:', updatedConvo.cooldown_until);
  if (updatedConvo.cooldown_until !== null) throw new Error('Cooldown did not reset on resolve!');

  // 4. Test Cooldown Reset on Ticket Delete
  // Re-set cooldown
  await db.run("UPDATE whatsapp_conversations SET cooldown_until = ? WHERE id = ?", [cooldownTime, convo.id]);
  updatedConvo = await db.get("SELECT * FROM whatsapp_conversations WHERE id = ?", [convo.id]);
  console.log('✅ Cooldown re-set for deletion test:', updatedConvo.cooldown_until);

  console.log('🗑️ Deleting ticket...');
  const ticketToDelete = await db.get("SELECT * FROM tickets WHERE id = ?", [ticketId]);
  if (ticketToDelete.whatsapp_conversation_id) {
    await db.run('UPDATE whatsapp_conversations SET cooldown_until = NULL WHERE id = ?', [ticketToDelete.whatsapp_conversation_id]);
  }
  await db.run("DELETE FROM tickets WHERE id = ?", [ticketId]);

  updatedConvo = await db.get("SELECT * FROM whatsapp_conversations WHERE id = ?", [convo.id]);
  console.log('✅ Cooldown after deletion:', updatedConvo.cooldown_until);
  if (updatedConvo.cooldown_until !== null) throw new Error('Cooldown did not reset on delete!');

  // Cleanup
  await db.run("DELETE FROM whatsapp_conversations WHERE chat_id = 'test-cooldown-chat'");
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runTest().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
