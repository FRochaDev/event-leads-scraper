import * as glide from "@glideapps/tables";
const GLIDE_TOKEN1 = process.env.GLIDE_TOKEN1;
const API_KEY = process.env.API_KEY;
const APP_ID = "ShpVU84S76vvqmQLshs7";
if (!GLIDE_TOKEN1) {
  throw new Error("Missing GLIDE_TOKEN environment variable");
}
const defaultWorkSheetItemTable = glide.table({
  token: GLIDE_TOKEN1,
  app: APP_ID,
  table: "native-table-4VYWpuJXQb31OnJrfw1i",
  columns: {
    itemName: { type: "string", name: "Name" },
    workTypeId: { type: "string", name: "9rqB9" },
    workItemGroupId: { type: "string", name: "YgvUT" },
    information: { type: "string", name: "ARyAE" },
    notas: { type: "string", name: "I3278" },
    alertDaysBeforeStart: { type: "number", name: "cvD5v" },
    alertDaysBeforeEnd: { type: "number", name: "jwGHN" },
    informationExtra: { type: "string", name: "ag56G" },
  },
});
const workSheetItemsTable = glide.table({
  token: GLIDE_TOKEN1,
  app: APP_ID,
  table: "native-table-FWJkwIeDHF69hhIgtfLS",
  columns: {
    projectId: { type: "string", name: "Smvdr" },
    itemName: { type: "string", name: "dySLn" },
    information: { type: "string", name: "9sjJw" },
    qty: { type: "number", name: "h2Nf1" },
    unit: { type: "string", name: "5okxH" },
    notas: { type: "string", name: "LxcaT" },
    alertDate: { type: "date-time", name: "w3rJH" },
    alertDaysBeforeStart: { type: "number", name: "uffDy" },
    alertDaysBeforeEnd: { type: "number", name: "Y8UWx" },
    sharableDocs: { type: "boolean", name: "xNhHa" },
    groupItemWorkItemGroupId: { type: "string", name: "vf0A5" },
    workStatusWorkStatusId: { type: "string", name: "XgJF9" },
    templateWorkTypeId: { type: "string", name: "Tcs9O" },
  },
});
function subtractDays(dateString, days) {
  if (!dateString || days === null || days === undefined) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() - Number(days));
  return date.toISOString();
}
export async function addDefaultTasks(req, res) {
  try {
    if (API_KEY && req.headers["x-api-key"] !== API_KEY) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const {
      projectID,
      workTypeID,
      workStatusID,
      projectStartDate,
      force = false,
    } = req.body;
    if (!projectID || !workTypeID || !workStatusID) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Missing required fields",
          required: ["projectID", "workTypeID", "workStatusID"],
        });
    }
    const defaultItems = await defaultWorkSheetItemTable.get();
    const matchingDefaultItems = defaultItems.filter(
      (item) => item.workTypeId === workTypeID,
    );
    if (matchingDefaultItems.length === 0) {
      return res
        .status(404)
        .json({
          success: false,
          error: "No default tasks found for this workTypeID",
          projectID,
          workTypeID,
        });
    }
    if (!force) {
      const existingItems = await workSheetItemsTable.get();
      const alreadyCreated = existingItems.some(
        (item) =>
          item.projectId === projectID &&
          item.templateWorkTypeId === workTypeID,
      );
      if (alreadyCreated) {
        return res
          .status(409)
          .json({
            success: false,
            error: "Default tasks already created for this project/work type",
            projectID,
            workTypeID,
          });
      }
    }
    const rowsToAdd = matchingDefaultItems.map((item) => ({
      projectId: projectID,
      itemName: item.itemName || "",
      information: item.information || "",
      notas: item.notas || "",
      alertDate: subtractDays(projectStartDate, item.alertDaysBeforeStart),
      alertDaysBeforeStart: item.alertDaysBeforeStart ?? null,
      alertDaysBeforeEnd: item.alertDaysBeforeEnd ?? null,
      groupItemWorkItemGroupId: item.workItemGroupId || "",
      workStatusWorkStatusId: workStatusID,
      templateWorkTypeId: workTypeID,
      sharableDocs: false,
    }));
    const addedRowIDs = await workSheetItemsTable.add(rowsToAdd);
    return res
      .status(200)
      .json({
        success: true,
        projectID,
        workTypeID,
        created: rowsToAdd.length,
        rowIDs: addedRowIDs,
      });
  } catch (error) {
    console.error("Error creating default tasks:", error);
    return res
      .status(500)
      .json({
        success: false,
        error: error.message || "Internal server error",
      });
  }
}