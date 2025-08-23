import { TEST_CONFIG } from '../config/test-config';

export function getRandomeTestUser() {
  const randomIndex = Math.floor(Math.random() * TEST_CONFIG.testusers.length);
  return TEST_CONFIG.testusers[randomIndex];
}

// rooms dont have names so this is not needed
export function getRandomRoomName() {
  const randomIndex = Math.floor(
    Math.random() * TEST_CONFIG.dataGeneration.roomNames.length
  );
  return TEST_CONFIG.dataGeneration.roomNames[randomIndex];
}

export function getRandomMessageTemplate() {
  const randomIndex = Math.floor(
    Math.random() * TEST_CONFIG.dataGeneration.messageTemplates.length
  );
  return TEST_CONFIG.dataGeneration.messageTemplates[randomIndex];
}
