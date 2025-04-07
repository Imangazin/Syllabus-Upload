let syllabusInput;
let uploadBtn;
let fileNameDisplay;
const syllabusUpload = document.getElementById("syllabusUpload");
const syllabusLink = document.getElementById("syllabusLink");
let selectedFile = null;
let orgUnitId;
let versions;
let roleId;
let orgUnitPath;
let instructional_role = [109,105,116];
let widgetId;
let widgetData;

async function widgetLoad(role_id,org_unit_id, org_unit_path, widget_id){
    orgUnitId = org_unit_id;
    roleId = role_id;
    versions = await getVersions();
    orgUnitPath = org_unit_path;
    widgetId = widget_id;

    response = await getWidgetData();
    if(response!=null){
        widgetData = response;
    }else {
        widgetData = {"moduleId":null, "topicId":null};
    } 

    if (widgetData.moduleId!=null) displaySyllabus();

    if (instructional_role.includes(roleId)){
        await setContentInfo();
        loadInstructorMode();

        if (widgetData.moduleId==null) {
            let isSyllabusExsist = await scanModules();
            if(isSyllabusExsist!=null){
                widgetData = {"moduleId":isSyllabusExsist, "topicId":null};
                await setWidgetData({"moduleId":widgetData.moduleId, "topicId":widgetData.topicId});
                displaySyllabus();
            }
        }
    }
}

async function getTOCIds(){
    let courseTOC =  await makeRequest(`/d2l/api/le/${versions.lp}/${orgUnitId}/content/toc`);
    if (!courseTOC || courseTOC.Modules.length === 0) return [];

    const result = [];
    const stack = [...courseTOC.Modules];

    while (stack.length > 0) {
        const currentModule = stack.pop();

        if (currentModule.ModuleId) {
            result.push(currentModule.ModuleId);
        }

        if (currentModule.Topics && currentModule.Topics.length > 0) {
            currentModule.Topics.forEach(topic => {
                if (topic.TopicId) {
                    result.push(topic.TopicId);
                }
            });
        }

        if (currentModule.Modules && currentModule.Modules.length > 0) {
            stack.push(...currentModule.Modules);
        }
    }
    return result;
}

async function displaySyllabus(){
    if ((await getTOCIds()).includes(widgetData.moduleId)){
        syllabusLink.href=`/d2l/le/lessons/${orgUnitId}/units/${widgetData.moduleId}`;
        syllabusLink.classList.remove("disabled-link");
    }
}

function toServerFormat(data) {
    return { "Data": JSON.stringify(data) };
}

function fromServerFormat(serverData) {
    if (serverData && serverData.Data) {
        return JSON.parse(serverData.Data);
    }
    return null;
}

async function getWidgetData(){
    let response = await makeRequest(`/d2l/api/lp/${versions.lp}/${orgUnitId}/widgetdata/${widgetId}`);
    if (response!=null){
        return fromServerFormat(response);
    } 
    return null;
}

async function setWidgetData(data){
    const token = await getToken();
    data = toServerFormat(data);
    await makeRequest(`/d2l/api/lp/${versions.lp}/${orgUnitId}/widgetdata/${widgetId}`, 'PUT', data, 'application/json', false, token.referrerToken);
}

async function scanModules(){
    let courseTOC =  await makeRequest(`/d2l/api/le/${versions.lp}/${orgUnitId}/content/toc?title=Syllabus`);
    return courseTOC.Modules.length > 0 ? courseTOC.Modules[0]?.ModuleId : null;
}


async function createModule(){
    const data = {
        "Title": "Syllabus",
        "ShortTitle": "Syllabus",
        "Type": 0,
        "ModuleStartDate": null,
        "ModuleEndDate": null,
        "ModuleDueDate": null,
        "IsHidden": false,
        "IsLocked": false,
        "Description": {"Content": "","Type": "Html"},
        "Duration": null
    }
    const token = await getToken();
    let createRootModule = await makeRequest(`/d2l/api/le/${versions.le}/${orgUnitId}/content/root/`, 'POST', data, 'application/json', false, token.referrerToken);
    widgetData.moduleId = createRootModule.Id;
    await makeRequest(`/d2l/api/le/${versions.le}/${orgUnitId}/content/order/objectId/${widgetData.moduleId}?position=first`, 'POST', {}, 'application/json', false, token.referrerToken);
    await setWidgetData({"moduleId":widgetData.moduleId, "topicId":widgetData.topicId});
}

async function setContentInfo(){
    let allIds = await getTOCIds();

    if(widgetData.moduleId!=null && !allIds.includes(widgetData.moduleId)){
        widgetData.moduleId = null;
        await setWidgetData({"moduleId":widgetData.moduleId, "topicId":widgetData.topicId});
    }

    if(widgetData.topicId!=null && !allIds.includes(widgetData.topicId)){
        widgetData.topicId = null;
        await setWidgetData({"moduleId":widgetData.moduleId, "topicId":widgetData.topicId});
    }
}


function loadInstructorMode() {
    syllabusUpload.innerHTML = `
        <hr>
        <div class="upload">
            <button class="syllabus-btn syllabus-btn-primary" id="uploadBtn" aria-label="Upload syllabus" tabindex="0">Upload your syllabus here</button>
            <input type="file" id="syllabusInput" style="display: none;"  />
        </div>
        <div id="fileName" aria-live="polite" aria-atomic="true"></div>
        <div class="legalInfoDisplay">Why are you seeing this?&nbsp; <a href="https://brocku.ca/vp-academic/2024/12/02/directive-on-the-costs-of-educational-materials/" target="_blank">  Find out more</a>.</div>`;
    
    const syllabusInput = document.getElementById("syllabusInput");
    const uploadBtn = document.getElementById("uploadBtn");
    const fileNameDisplay = document.getElementById("fileName");
    uploadBtn.setAttribute("tabindex", "0");
    uploadBtn.setAttribute("role", "button"); 

    uploadBtn.addEventListener("click", () => {
        syllabusInput.click(); // Trigger the file picker
    });

    syllabusInput.addEventListener("change", async (event) => {
        const selectedFile = event.target.files[0];
        if (selectedFile) {
            uploadBtn.textContent = "Uploading...";
            uploadBtn.disabled = true;
            uploadBtn.setAttribute("aria-disabled", "true");

            try {
                const response = await uploadSyllabus(selectedFile);
                if (response !== null) {
                    fileNameDisplay.classList.add('feedback', 'feedback-info');
                    fileNameDisplay.textContent = `File ${selectedFile.name} was successfully uploaded!`;
                    displaySyllabus();
                    fileNameDisplay.focus();
                } else {
                    fileNameDisplay.classList.add('feedback', 'feedback-danger');
                    fileNameDisplay.textContent = 'File upload failed! Please try again or contact edtech@brocku.ca';
                    fileNameDisplay.focus();
                }
            } catch (error) {
                console.error("Upload Error:", error);
                fileNameDisplay.classList.add('feedback', 'feedback-danger');
                fileNameDisplay.textContent = 'An error occurred during the upload process. Please try again or contact edtech@brocku.ca.';
                fileNameDisplay.focus();
            } finally {
                uploadBtn.textContent = "Upload";
                uploadBtn.disabled = false;
                uploadBtn.setAttribute("aria-disabled", "false");
                fileNameDisplay.focus();
            }
        }
    });
}


async function uploadSyllabus(file) {
    const token = await getToken();
    let url;
    let method;
    let contentType;

    // check if module exsist if not create one
    if(widgetData.moduleId==null){
        await createModule();
    } 

    // Create the boundary for multipart/form-data
    const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2, 18)}`;

    // Prepare metadata as a JSON object
    const metadata = {
        "Title": "Syllabus",
        "ShortTitle": "Syllabus",
        "Type": 1,
        "TopicType": 1,
        "Url": orgUnitPath + 'Syllabus/' + file.name,
        "StartDate": null,
        "EndDate": null,
        "DueDate": null,
        "IsHidden": false,
        "IsLocked": false,
        "OpenAsExternalResource": null,
        "Description": null,
        "MajorUpdate": null,
        "MajorUpdateText": '',
        "ResetCompletionTracking": null,
        "Duration": null
    };

    // Read the file as an ArrayBuffer to preserve binary content
    const fileBuffer = await file.arrayBuffer();

    // Convert ArrayBuffer to a Uint8Array for easy manipulation
    const fileArray = new Uint8Array(fileBuffer);

    // Create the multipart request body as an array of Uint8Arrays and metadata
    let bodyParts = [];
    if (widgetData.topicId==null){
        url = `/d2l/api/le/${versions.le}/${orgUnitId}/content/modules/${widgetData.moduleId}/structure/`;
        method = 'POST';
        contentType = `multipart/mixed; boundary=${boundary}`;
        bodyParts.push(new TextEncoder().encode(`--${boundary}\r\n`));
        bodyParts.push(new TextEncoder().encode(`Content-Disposition: form-data; name="topic"\r\n`));
        bodyParts.push(new TextEncoder().encode(`Content-Type: application/json\r\n\r\n`));
        bodyParts.push(new TextEncoder().encode(`${JSON.stringify(metadata)}\r\n`));
    } else {
        url =`/d2l/api/le/${versions.le}/${orgUnitId}/content/topics/${widgetData.topicId}/file`;
        method = 'PUT';
        contentType = `multipart/form-data; boundary=${boundary}`;
    }

    bodyParts.push(new TextEncoder().encode(`--${boundary}\r\n`));
    bodyParts.push(new TextEncoder().encode(`Content-Disposition: form-data; name="file"; filename="${file.name}"\r\n`));
    bodyParts.push(new TextEncoder().encode(`Content-Type: ${file.type}\r\n\r\n`));
    bodyParts.push(fileArray); // Add the binary file content
    bodyParts.push(new TextEncoder().encode(`\r\n--${boundary}--\r\n`)); // Close the boundary

    // Combine all parts into a single Uint8Array
    let totalLength = 0;
    bodyParts.forEach(part => totalLength += part.length);
    const combinedArray = new Uint8Array(totalLength);
    let offset = 0;
    bodyParts.forEach(part => {
        combinedArray.set(part, offset);
        offset += part.length;
    });

    // Call makeRequest using the binary data
    try {
        const response = await makeRequest(
            url,
            method,
            { body: combinedArray, boundary: boundary, contentType: `multipart/form-data; boundary=${boundary}` },
            contentType,
            true,
            token.referrerToken
        );
        if (method==='POST'){
            widgetData.topicId = response.Id;
            await setWidgetData({"moduleId":widgetData.moduleId, "topicId":widgetData.topicId});
        }
        return response;        
    } catch (error) {
        console.error(`Error uploading syllabus:`, error);
    }
}

async function makeRequest(url, method = 'GET', data = null, contentType = 'application/json', isMultipart = false, xrsfToken='') {
    try {
        const options = {
            method: method.toUpperCase(),
            headers: {}
        };
        // For JSON requests
        if (!isMultipart) {
            options.headers['Content-Type'] = contentType;
            if (data) {options.body = JSON.stringify(data); options.headers['X-Csrf-Token'] = xrsfToken;}
        } 
        // For Multipart/Mixed requests
        else if (isMultipart) {
            options.headers['Content-Type'] = contentType;
            options.headers['X-Csrf-Token'] = xrsfToken;
            options.body = new Blob([data.body], { type: data.contentType });
        }

        const response = await fetch(url, options);

        if (response.status === 404) {
            // Do nothing and return null if the status is 404
            return null;
        }

        if (response.headers.has('Content-Type')) {
            if (response.headers.get('Content-Type').includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }
        } else {
            // Handle case where no Content-Type header is present
            return await response.text();
        }
    } catch (error) {
        console.log(`Error in ${method} request:`, error);
        return null;
    }
}

async function getToken(){
    return await makeRequest('/d2l/lp/auth/xsrf-tokens');
}

async function getVersions(){
    let response = await makeRequest(`/d2l/api/versions/`);
    return {
        "lp": response.find(product => product.ProductCode === 'lp').LatestVersion,
        "le": response.find(product => product.ProductCode === 'le').LatestVersion
    }
}