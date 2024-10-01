import { Firestore } from '@google-cloud/firestore';
import { OpenAI } from 'openai';
import * as speechToText from './speechToText'
import { OPENAI_API_KEY } from '../configs';

const db = new Firestore();

const getTaskCollectionRef = (userId: string, taskListId: string) => {
  console.log('user_id:', userId, 'task_list_id:', taskListId);

  if (taskListId === 'default') {
    return db.collection("user").doc(userId).collection("task");
  } else {
    return db.collection("user").doc(userId).collection("task_list").doc(taskListId).collection("task");
  }
};

const template = `You are an agent that helps chunk a text into a meaningful task list.
User provides a single text that contains multiple tasks, and you need to extract each task and provide a list of tasks.
Constraints:
- The text will be either in English or Japanese or a mix of both.`;
export const processAudio = async (audioFile: string, userId: string, listId: string): Promise<string | null> => {
  try {
    const openAiKey = OPENAI_API_KEY.value();

    console.log("running process_audio", audioFile, openAiKey, userId, listId);

    const client = new OpenAI({ apiKey: openAiKey });

    let messages = [{ role: "system", content: template }];

    const userMessage = await speechToText.speechToText(audioFile, openAiKey);

    if (userMessage === "") {
      return null;
    }

    console.log("Your message: \n", userMessage);
    messages.push({ role: "user", content: userMessage });

    const response = await client.chat.completions.create({
      messages: [{ role: "system", content: template }],
      model: "gpt-4-turbo",
    });

    const botMessage = response.choices[0].message.content;
    console.log(typeof botMessage);
    if (!botMessage) {
      throw new Error("No response from chatbot");
    }
    await saveTaskToDatabase(botMessage, userId, listId);
    console.log("Chatbot's response : \n", botMessage);

    return botMessage;
  } catch (e) {
    console.error("An error occurred while processing the audio.", e);
    return null;
  }
};



// export const processAudio = async (audioFile: string, openApiKey: string, userId: string, listId: string): Promise<string | null> => {
//   try {
//     console.log("running process_audio", audioFile, openApiKey, userId, listId);

//     const client = new OpenAI({ apiKey: openApiKey });

//     let messages = [{ role: "system", content: template }];

//     const userMessage = await speechToText.speechToText(audioFile, openApiKey);

//     if (userMessage === "") {
//       return null;
//     }

//     console.log("Your message: \n", userMessage);
//     messages.push({ role: "user", content: userMessage });

//     const response = await client.chat.completions.create({
//       messages: messages,
//       model: "gpt-4-turbo",
//     });

//     const botMessage = response.choices[0].message.content;
//     console.log(typeof botMessage);
//     await saveTaskToDatabase(botMessage, userId, listId);
//     console.log("Chatbot's response : \n", botMessage);

//     return botMessage;
//   } catch (e) {
//     console.error("An error occurred while processing the audio.", e);
//     return null;
//   }
// };

export const testConnection = async () => {
  try {
    await db.collection("test").doc("test").set({ test: "test" });
    console.log("Firestore connection successful.");
    const openAiKey = OPENAI_API_KEY.value();
    console.log("OpenAI API key:", openAiKey);

  } catch (e) {
    console.error("Firestore connection failed.", e);
  }
}

const saveTaskToDatabase = async (botMessage: string, userId: string, listId: string): Promise<void> => {
  try {
    console.log('bot_message:', botMessage);

    const tasks = botMessage.trim().split("\n");

    const currentDate = new Date();

    for (const task of tasks) {
      if (task) {
        const taskParts = task.split(".", 2);
        if (taskParts.length === 2) {
          const taskNumber = taskParts[0].trim();
          const taskName = taskParts[1].trim();
          console.log('task_number:', taskNumber, 'task_name:', taskName);

          const taskCollectionRef = getTaskCollectionRef(userId, listId);

          const taskRef = taskCollectionRef.doc();

          await taskRef.set({
            name: taskName,
            created_at: currentDate,
            completed: false,
            starred: false,
          });
        }
      }
    }

    console.log("Tasks stored in Firestore successfully.");
  } catch (e) {
    console.error("An error occurred while storing tasks in Firestore.", e);
  }
};

export const getCompletedTasks = async (userDocId: string, listId: string): Promise<any[]> => {
  const taskCollectionRef = getTaskCollectionRef(userDocId, listId);
  const completedTasks = await taskCollectionRef.where("completed", "==", true).get();

  const tasks: any[] = [];
  completedTasks.forEach(doc => {
    const taskData = doc.data();
    taskData.id = doc.id;
    tasks.push(taskData);
  });

  return tasks;
};

export const getIncompleteTasks = async (userDocId: string, listId: string): Promise<any[]> => {
  const taskCollectionRef = getTaskCollectionRef(userDocId, listId);
  const incompleteTasks = await taskCollectionRef.where("completed", "==", false).get();

  const tasks: any[] = [];
  incompleteTasks.forEach(doc => {
    const taskData = doc.data();
    taskData.id = doc.id;
    tasks.push(taskData);
  });

  return tasks;
};

export const createTask = async (userDocId: string, taskData: any): Promise<string | undefined> => {
  console.log('task_data:', taskData);

  if (typeof taskData === 'string') {
    try {
      taskData = JSON.parse(taskData);
      taskData.completed = false;
      taskData.starred = false;
    } catch (error) {
      console.error("Error: task_data is not a valid JSON string");
      return;
    }
  }

  const listId = taskData.list_id;

  if (!listId) {
    console.error("Error: list_id is required to create a task");
    return;
  }

  const taskDataCopy = { ...taskData };
  delete taskDataCopy.list_id;

  console.log('task_data_copy:', taskDataCopy);

  const collectionRef = getTaskCollectionRef(userDocId, listId);
  const taskRef = collectionRef.doc();
  await taskRef.set(taskDataCopy);
  console.log("Task created successfully.");

  return taskRef.id;
};

export const markTaskAsCompleted = async (userDocId: string, taskId: string): Promise<void> => {
  const taskRef = db.collection("user").doc(userDocId).collection("task").doc(taskId);
  await taskRef.update({ completed: true });
  console.log("Task marked as completed successfully.");
};

export const markTaskAsIncomplete = async (userDocId: string, taskId: string): Promise<void> => {
  const taskRef = db.collection("user").doc(userDocId).collection("task").doc(taskId);
  await taskRef.update({ completed: false });
  console.log("Task marked as incomplete successfully.");
};

export const deleteTask = async (userDocId: string, listId: string, taskId: string): Promise<void> => {
  const collectionRef = getTaskCollectionRef(userDocId, listId);
  const taskRef = collectionRef.doc(taskId);
  await taskRef.delete();
  console.log("Task deleted successfully.");
};

export const getAllTasks = async (userDocId: string): Promise<any[]> => {
  const userRef = db.collection("user").doc(userDocId);
  const allTasks = await userRef.collection("task").get();

  const tasks: any[] = [];
  allTasks.forEach(doc => {
    const taskData = doc.data();
    tasks.push(taskData);
  });

  return tasks;
};

export const getTaskById = async (userDocId: string, taskId: string): Promise<any | null> => {
  const taskRef = db.collection("user").doc(userDocId).collection("task").doc(taskId);
  const taskDoc = await taskRef.get();
  return taskDoc.data() || null;
};

export const updateTaskName = async (userDocId: string, taskId: string, newName: string): Promise<void> => {
  const taskRef = db.collection("user").doc(userDocId).collection("task").doc(taskId);
  await taskRef.update({ name: newName });
  console.log("Task name updated successfully.");
};

export const updateTask = async (userDocId: string, taskId: string, taskData: any): Promise<void> => {
  const taskRef = db.collection("user").doc(userDocId).collection("task").doc(taskId);
  await taskRef.update(taskData);
  console.log("Task updated successfully.");
};

export const updateTaskPriority = async (userDocId: string, taskId: string, priority: any): Promise<void> => {
  const taskRef = db.collection("user").doc(userDocId).collection("task").doc(taskId);
  await taskRef.update({ priority: priority });
  console.log("Task priority updated successfully.");
};

export const updateTaskCategory = async (userDocId: string, taskId: string, category: string): Promise<void> => {
  const taskRef = db.collection("user").doc(userDocId).collection("task").doc(taskId);
  await taskRef.update({ category: category });
  console.log("Task category updated successfully.");
};

export const updateTaskTags = async (userDocId: string, taskId: string, tags: string[]): Promise<void> => {
  const taskRef = db.collection("user").doc(userDocId).collection("task").doc(taskId);
  await taskRef.update({ tags: tags });
  console.log("Task tags updated successfully.");
};

export const updateTaskDuration = async (userDocId: string, taskId: string, duration: number): Promise<void> => {
  const taskRef = db.collection("user").doc(userDocId).collection("task").doc(taskId);
  await taskRef.update({ duration: duration });
  console.log("Task duration updated successfully.");
};

export const updateTaskStartTime = async (userDocId: string, taskId: string, startTime: Date): Promise<void> => {
  const taskRef = db.collection("user").doc(userDocId).collection("task").doc(taskId);
  await taskRef.update({ start_time: startTime });
  console.log("Task start time updated successfully.");
};

export const updateTaskEndTime = async (userDocId: string, taskId: string, endTime: Date): Promise<void> => {
  const taskRef = db.collection("user").doc(userDocId).collection("task").doc(taskId);
  await taskRef.update({ end_time: endTime });
  console.log("Task end time updated successfully.");
};

export const updateTaskRecurring = async (userDocId: string, taskId: string, recurring: boolean): Promise<void> => {
  const taskRef = db.collection("user").doc(userDocId).collection("task").doc(taskId);
  await taskRef.update({ recurring: recurring });
  console.log("Task recurring status updated successfully.");
};

export const updateTaskRecurrenceRule = async (userDocId: string, taskId: string, recurrenceRule: string): Promise<void> => {
  const taskRef = db.collection("user").doc(userDocId).collection("task").doc(taskId);
  await taskRef.update({ recurrence_rule: recurrenceRule });
  console.log("Task recurrence rule updated successfully.");
};

export const updateTaskRecurrenceEndDate = async (userDocId: string, taskId: string, recurrenceEndDate: Date): Promise<void> => {
  const taskRef = db.collection("user").doc(userDocId).collection("task").doc(taskId);
  await taskRef.update({ recurrence_end_date: recurrenceEndDate });
  console.log("Task recurrence end date updated successfully.");
};

export const updateTaskRecurrenceCount = async (userDocId: string, taskId: string, recurrenceCount: number): Promise<void> => {
  const taskRef = db.collection("user").doc(userDocId).collection("task").doc(taskId);
  await taskRef.update({ recurrence_count: recurrenceCount });
  console.log("Task recurrence count updated successfully.");
};

export const updateTaskRecurrenceInterval = async (userDocId: string, taskId: string, recurrenceInterval: number): Promise<void> => {
  const taskRef = db.collection("user").doc(userDocId).collection("task").doc(taskId);
  await taskRef.update({ recurrence_interval: recurrenceInterval });
  console.log("Task recurrence interval updated successfully.");
};

export const updateTaskRecurrenceDays = async (userDocId: string, taskId: string, recurrenceDays: string[]): Promise<void> => {
  const taskRef = db.collection("user").doc(userDocId).collection("task").doc(taskId);
  await taskRef.update({ recurrence_days: recurrenceDays });
  console.log("Task recurrence days updated successfully.");
};

export const createTag = async (userDocId: string, tagName: string): Promise<void> => {
  const tagRef = db.collection("user").doc(userDocId).collection("task_tag").doc();
  await tagRef.set({ name: tagName });
  console.log("Tag created successfully.");
};

export const getAllTags = async (userDocId: string): Promise<any[]> => {
  const userRef = db.collection("user").doc(userDocId);
  const allTags = await userRef.collection("task_tag").get();

  const tags: any[] = [];
  allTags.forEach(doc => {
    const tagData = doc.data();
    tags.push(tagData);
  });

  return tags;
};

export const createCategory = async (userDocId: string, categoryName: string): Promise<void> => {
  const categoryRef = db.collection("user").doc(userDocId).collection("task_category").doc();
  await categoryRef.set({ name: categoryName });
  console.log("Category created successfully.");
};

export const getAllCategories = async (userDocId: string): Promise<any[]> => {
  const userRef = db.collection("user").doc(userDocId);
  const allCategories = await userRef.collection("task_category").get();

  const categories: any[] = [];
  allCategories.forEach(doc => {
    const categoryData = doc.data();
    categories.push(categoryData);
  });

  return categories;
};

export const createTaskList = async (userDocId: string, taskListName: string): Promise<string> => {
  const taskListRef = db.collection("user").doc(userDocId).collection("task_list").doc();
  await taskListRef.set({ name: taskListName });
  console.log("Task list created successfully.");
  return taskListRef.id;
};

export const getAllTaskLists = async (userDocId: string): Promise<any[]> => {
  const userRef = db.collection("user").doc(userDocId);
  const allTaskLists = await userRef.collection("task_list").get();

  const taskLists: any[] = [];
  allTaskLists.forEach(doc => {
    const taskListData = doc.data();
    taskListData.id = doc.id;
    taskLists.push(taskListData);
  });

  return taskLists;
};

export const getTasksByList = async (userDocId: string, listId: string): Promise<any[]> => {
  const taskListRef = db.collection("user").doc(userDocId).collection("task_list").doc(listId);
  const allTasks = await taskListRef.collection("task").get();

  const tasks: any[] = [];
  allTasks.forEach(doc => {
    const taskData = doc.data();
    taskData.id = doc.id;
    tasks.push(taskData);
  });

  return tasks;
};

export const starTask = async (userDocId: string, listId: string, taskId: string): Promise<void> => {
  const collectionRef = getTaskCollectionRef(userDocId, listId);
  const taskRef = collectionRef.doc(taskId);
  await taskRef.update({ starred: true });
  console.log("Task starred successfully.");
};

export const unstarTask = async (userDocId: string, listId: string, taskId: string): Promise<void> => {
  console.log('unstar_task:', userDocId, listId, taskId);
  const collectionRef = getTaskCollectionRef(userDocId, listId);
  const taskRef = collectionRef.doc(taskId);
  await taskRef.update({ starred: false });
  console.log("Task unstarred successfully.");
};

export const getStarredTasks = async (userDocId: string): Promise<any[]> => {
  const starredTasks: any[] = [];

  const defaultTaskCollection = getTaskCollectionRef(userDocId, "default");
  const defaultStarredTasks = await defaultTaskCollection.where("starred", "==", true).get();
  defaultStarredTasks.forEach(doc => {
    const taskData = doc.data();
    taskData.id = doc.id;
    taskData.list_id = "default";
    starredTasks.push(taskData);
  });

  const userRef = db.collection("user").doc(userDocId);
  const taskListCollections = await userRef.collection("task_list").listDocuments();

  for (const taskListCollection of taskListCollections) {
    const taskCollection = getTaskCollectionRef(userDocId, taskListCollection.id);
    const starredTasksInList = await taskCollection.where("starred", "==", true).get();
    starredTasksInList.forEach(doc => {
      const taskData = doc.data();
      taskData.id = doc.id;
      taskData.list_id = taskListCollection.id;
      starredTasks.push(taskData);
    });
  }

  return starredTasks;
};