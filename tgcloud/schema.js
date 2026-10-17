import {table,integer,text} from 'sdk/db';
export const settings=table('dmx_settings',{
 name:text('name').primaryKey(),
 value:text('value').notNull()
});
export const profiles=table('dmx_profiles',{
 userId:integer('user_id').primaryKey(),
 data:text('data').notNull()
});
export const botVisits=table('dmx_bot_visits',{
 userId:integer('user_id').primaryKey(),
 lastMessageId:integer('last_message_id').notNull(),
 lastAttemptAt:integer('last_attempt_at').notNull(),
 welcomedAt:integer('welcomed_at')
});
