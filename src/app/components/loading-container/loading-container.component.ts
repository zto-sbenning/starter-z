import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AppLoading } from '../../core/state/app/app.config';

@Component({
  selector: 'app-loading-container',
  templateUrl: './loading-container.component.html',
  styleUrls: ['./loading-container.component.css']
})
export class LoadingContainerComponent implements OnInit {

  constructor(
    public dialogRef: MatDialogRef<LoadingContainerComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AppLoading
  ) { }

  ngOnInit() {
    console.log('GOT: ', this.data);
  }
  
  onNoClick(): void {
    this.dialogRef.close();
  }

}
