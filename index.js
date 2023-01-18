// Functions exports
const functions = require("firebase-functions");

const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

exports.internalQuestionAnswered = functions.firestore
  .document("InternalCultureQuestions2/{questionareID}")
  .onUpdate(async (change, context) => {
    // Get an object representing the document
    // e.g. {'name': 'Marie', 'age': 66}
    const newValue = change.after.data();

    // ...or the previous value before this update
    // const previousValue = change.before.data();

    // access a particular field as you would any JS property
    console.log(newValue.email);
    const cityRef = db.collection("InternalCultureSummary");
    const getDoc = await cityRef.where("companyRef", "==", newValue.companyRef).limit(1).get();
    if (getDoc.empty) {
      console.log("companyRef Matches no summary!");
      let summary = undefined;
      let keys = Object.keys(newValue);
      console.log("KEYS:")
      console.log(keys)
      for (let i = 0; i < keys.length; i++) {
        // Creating Summary object
        let key = keys[i];
        if (key !== "email" && key !== "uid" && key !== "complete" && key !== "companyRef") {
          // Start the summary
          if (!summary) {
            summary = {};
          }
          if (!summary[key]) {
            summary[key] = {};
          }
          if (Array.isArray(newValue[key])) {
            // This is an array
            for (let j = 0; j < newValue[key].length; j++) {
              if (!summary[key][newValue[key][j]]) {
                summary[key][newValue[key][j]] = 0;
              }
              summary[key][newValue[key][j]] += 1;
            }
          } else {
            // if not array answer
            if (!summary[key][newValue[key]]) {
              summary[key][newValue[key]] = 0;
            }
            summary[key][newValue[key]] += 1;
          }
        }
      }
      const res = await db.collection('InternalCultureSummary').add({
        companyRef: newValue.companyRef,
        answered: [newValue.email],
        summary: summary
      });
      console.log('Added document with ID: ', res.id);
    }
    console.log("companyRef matches a summary!")
    getDoc.forEach(async (docItem) => {
      const doc = docItem.data();
      let keys = Object.keys(newValue);
      let summary = doc.summary;
      for (let i = 0; i < keys.length; i++) {
        // Creating Summary object
        let key = keys[i];
        if (key !== "email" && key !== "uid" && key !== "complete" && key !== "companyRef") {
          // Start the summary
          if (!summary) {
            summary = {};
          }
          if (!summary[key]) {
            summary[key] = {};
          }
          if (Array.isArray(newValue[key])) {
            // This is an array
            for (let j = 0; j < newValue[key].length; j++) {
              if (!summary[key][newValue[key][j]]) {
                summary[key][newValue[key][j]] = 0;
              }
              summary[key][newValue[key][j]] += 1;
            }
          } else {
            // if not array answer
            if (!summary[key][newValue[key]]) {
              summary[key][newValue[key]] = 0;
            }
            summary[key][newValue[key]] += 1;
          }
        }
      }
      // Update summary match points
      let summaryPointSystem = {}
      keys = Object.keys(summary);
      for (i = 0; i < keys.length; i++) {
        let key = keys[i];
        let arrKeys = Object.keys(summary[key]);
        let arr = Object.values(summary[key]);
        let max = Math.max(...arr);
        summaryPointSystem[key] = {};
        for (j = 0; j < arr.length; j++) {
          summaryPointSystem[key][arrKeys[j]] = (summary[key][arrKeys[j]] / max).toFixed(2);
        };
      };

      // Add email toi answered list
      let answered = doc.answered;
      answered.push(newValue.email);

      // Update company's summary document
      const cityRef = db.collection('InternalCultureSummary').doc(docItem.id);
      await cityRef.update({ summary: summary, answered: answered, pointSystem: summaryPointSystem });
    });
  });

exports.jobApplied = functions.firestore
  .document("appliedJobs/{appliedJobID}")
  .onCreate(async (snap, context) => {
    // Get an object representing the document
    // e.g. {'name': 'Marie', 'age': 66}
    const newValue = snap.data();

    if (newValue.CultureMatch) {
      // Failsafe for infinite loops
      return null;
    }

    // We need to update the culture variable in this appliedJob Document
    // ◊ To do that, we need the user's culture answers
    let userCulture;
    // ◊ We need the company's culture summary
    let companyCulture;
    // ◊◊◊◊◊◊ ****** VERY IMPORTANT - The company ref doesnot make sense!!
    // ◊ Then compare and update result in the appliedJob Document

    // · User's culture answers
    // Under document "EmployeeQuestionnaire" a variable "User" has the user reference === "userApplied"
    let cityRef = db.collection("EmployeeQuestionnaire");
    let getDoc = await cityRef.where("User", "==", newValue.userApplied).limit(1).get();
    if (getDoc.empty) {
      console.log("User Reference did not match any EmpoyeeQuestionare");
      console.log("This could be because the user has not answered the culture part");
    }
    console.log("User did match and we can get the user's culture");
    getDoc.forEach(async (docItem) => {
      userCulture = docItem.data();
      console.log(userCulture);
    });

    // · We need the company's culture summary
    // Under "InternalCultureSummary" is a variable "companyRef" === "PostedBy"
    cityRef = db.collection("InternalCultureSummary");
    getDoc = await cityRef.where("companyRef", "==", newValue.PostedBy).limit(1).get();
    if (getDoc.empty) {
      console.log("Company Reference did not match any InternalCultureSummary");
      console.log("This could be because the company's internal staff has not answered culture questionare!");
    }
    console.log("Company did match and we can get the company's culture");
    getDoc.forEach((docItem) => {
      companyCulture = docItem.data();
    });

    // · Then compare and update result in the appliedJob Document
    console.log(companyCulture);
    delete userCulture.User;
    let totalQuestions = 0;
    let totalRate = 0;
    let keys = Object.keys(userCulture);
    for (let i = 0; i < keys.length; i++) {
      let key = keys[i];
      console.log(key);
      if (!companyCulture.pointSystem) {
        return null;
      }
      if (!companyCulture.pointSystem[key]) {
        // THis question has not been answered by any internal employee
        console.log(key + " has not been answered by any internal employee")
        continue;
      }
      totalQuestions = totalQuestions + 1;
      if (Array.isArray(userCulture[key])) {
        // This is an array
        for (let j = 0; j < userCulture[key].length; j++) {
          if (!companyCulture.pointSystem[key][userCulture[key][j]]) {
            // This answer has not been recorded yet, so no points :(
          } else {
            console.log([userCulture[key]] + " is an array answer with total points of " + companyCulture.pointSystem[key][userCulture[key][j]] + " then we devide it " + (parseFloat(companyCulture.pointSystem[key][userCulture[key][j]]) / (userCulture[key].length)));
            totalRate = totalRate + (parseFloat(companyCulture.pointSystem[key][userCulture[key][j]]) / userCulture[key].length);
          };
        };
      } else {
        // This is a single string answer
        if (!companyCulture.pointSystem[key][userCulture[key]]) {
          // This answer has not been recorded yet, so no points :(
        } else {
          console.log([userCulture[key]] + " is the answer with total points of " + companyCulture.pointSystem[key][userCulture[key]])
          totalRate = totalRate + parseFloat(companyCulture.pointSystem[key][userCulture[key]]);
        };
      };
    }
    if (totalQuestions === 0) {
      totalQuestions = 1;
    };
    console.log("totalRate: " + totalRate);
    console.log("totalQuestions: " + totalQuestions);
    const cultureMatch = (totalRate / totalQuestions).toFixed(2) * 100;
    
    if (!cultureMatch) {
      // Failsafe for infinite loops
      cultureMatch = 0;
    };
    console.log(cultureMatch);

    // Now update document "CultureMatch"
    return snap.ref.set({
      CultureMatch: cultureMatch
    }, {merge: true});
  });
