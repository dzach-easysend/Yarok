# Set up persistent photo storage on Railway (step-by-step)

On Railway, the server’s disk is **temporary**: when you redeploy, any uploaded photos are lost and the app can show broken images. To keep photos across redeploys, use **Railway Storage Buckets** (S3-compatible storage) and connect them to your API.

Follow these steps in order. You only need the Railway dashboard; no code or terminal required.

**What about my local machine?** When you run the backend locally, you normally don’t set the S3 variables. In that case uploads go to a folder on your computer (e.g. `backend/uploads/`) and the app serves them from there. Local development works without any bucket or S3 setup.

---

## Step 1: Create a Storage Bucket

1. Open your **Railway project** (the one that has **yarok-api** and **yarok-web**).
2. On the project **canvas** (the main view with your services), click the **"+ New"** or **"Create"** button.
3. Choose **"Bucket"** (or **"Storage"** / **"Storage Bucket"**).
4. Pick a **region** (e.g. the one closest to you). You can’t change it later.
5. Optionally give the bucket a **name** (e.g. `yarok-media`). Railway will add a short suffix to make it unique.
6. Confirm creation. The new bucket will appear on the canvas.

---

## Step 2: Get the bucket’s credentials

1. Click the **bucket** you just created to open it.
2. Open the **"Credentials"** or **"Variables"** tab (Railway shows the S3 credentials here).
3. You should see variables like:
   - **ENDPOINT** (e.g. `https://storage.railway.app`)
   - **BUCKET** (e.g. `yarok-media-abc123`)
   - **ACCESS_KEY_ID**
   - **SECRET_ACCESS_KEY**
   - **REGION** (e.g. `auto`)

Keep this tab open; you’ll use these in the next step. You can also use **Variable References** so you don’t copy secret values by hand.

---

## Step 3: Connect the bucket to yarok-api

You need to pass the bucket’s credentials into the **yarok-api** service so it can save and serve photos.

1. Open the **yarok-api** service (click it on the canvas).
2. Go to the **"Variables"** tab.
3. Add these **five** variables. You can either **reference** the bucket’s variables (recommended) or paste values.

   **Option A – Using references (recommended)**  
   A “reference” means: instead of pasting the secret, you point to the bucket’s variable by name. Railway then injects the value at deploy time.

   **How to add each reference:**

   1. Click **“+ New Variable”** (or “Add Variable”).
   2. In **Name**, type exactly: `S3_ENDPOINT_URL` (then for the next variables use `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`).
   3. In **Value**, type `${{` (dollar, two curly braces). A dropdown should appear.
   4. In the dropdown, choose your **bucket** (the same one you created). Railway may show it as “Bucket” or the name you gave it (e.g. “yarok-media”).
   5. After you select the bucket, you can pick the variable. For the first one choose **ENDPOINT**, then add the other variables and pick **BUCKET**, **REGION**, **ACCESS_KEY_ID**, and **SECRET_ACCESS_KEY**.
   6. If the dropdown doesn’t appear, type the reference by hand: `${{Bucket.ENDPOINT}}` — but replace `Bucket` with the **exact service name** of your bucket as shown on the project canvas (e.g. `yarok-media`). No spaces. The format is always `${{ServiceName.VARIABLE_NAME}}`.

   Summary of what to create:

   | Variable name       | Value (use dropdown or type)        |
   |--------------------|--------------------------------------|
   | `S3_ENDPOINT_URL`  | `${{YourBucketName.ENDPOINT}}`       |
   | `S3_BUCKET`        | `${{YourBucketName.BUCKET}}`        |
   | `S3_REGION`        | `${{YourBucketName.REGION}}`        |
   | `S3_ACCESS_KEY`    | `${{YourBucketName.ACCESS_KEY_ID}}`  |
   | `S3_SECRET_KEY`    | `${{YourBucketName.SECRET_ACCESS_KEY}}` |

   **Option B – Copy-paste**  
   Copy each value from the bucket’s Credentials tab into a new variable in yarok-api with the names in the table above. Do **not** share these values or commit them to git.

4. Click **"Add"** or **"Save"** for each variable.

---

## Step 4: Redeploy yarok-api

1. After saving the variables, Railway will show that there are **staged changes**.
2. Click **"Deploy"** or **"Redeploy"** so that yarok-api restarts with the new S3 variables.
3. Wait until the deployment is **Active** (green).

From now on, **new** uploads will go to the bucket and will survive redeploys. Old photos that were uploaded before this setup are still only on the old server disk and may show as missing until users upload again.

---

## Summary

| What you did | Why it helps |
|--------------|--------------|
| Created a Bucket | Gives you a permanent place to store files on Railway. |
| Added 5 variables to yarok-api | Tells the API where and how to upload (endpoint, bucket name, keys, region). |
| Redeployed yarok-api | Applies the new configuration so uploads use the bucket. |

If something doesn’t work: double-check the variable **names** (e.g. `S3_ENDPOINT_URL` not `ENDPOINT`) and that you redeployed **yarok-api** after changing variables.
